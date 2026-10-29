import { randomBytes, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MAIL_SERVICE, type MailService } from '../mail/mail.types';
import { AuthRateLimiter } from './rate-limiter';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(MAIL_SERVICE) private readonly mailService: MailService,
    private readonly rateLimiter: AuthRateLimiter,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email này đã được đăng ký');

    this.validatePasswordPolicy(input.password);
    const passwordHash = await bcrypt.hash(input.password, 10);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          fullName: input.name.trim(),
          passwordHash,
          role: Role.CUSTOMER,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          loyaltyPoints: true,
          role: true,
          sessionVersion: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Email này đã được đăng ký');
      throw error;
    }
    return {
      user: this.publicUser(user),
      accessToken: await this.signToken(user.id, user.role, user.sessionVersion),
    };
  }

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await bcrypt.compare(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    return {
      user: this.publicUser(user),
      accessToken: await this.signToken(user.id, user.role, user.sessionVersion),
    };
  }

  async forgotPassword(input: ForgotPasswordDto, ip: string) {
    this.rateLimiter.checkForgotPasswordLimit(ip, input.email);
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Không tiết lộ email có tồn tại hay không
    if (!user || user.status !== UserStatus.ACTIVE) {
      return {
        message:
          'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.',
      };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await this.prisma.$transaction(async (tx) => {
      // Vô hiệu hóa mọi token cũ của user
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    });

    const frontendUrl =
      process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Không ghi token, mật khẩu hoặc link khôi phục vào log
    try {
      await this.mailService.sendPasswordResetEmail(user.email, resetLink);
    } catch {
      this.logger.error('Không thể gửi email đặt lại mật khẩu');
    }

    return {
      message:
        'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.',
    };
  }

  async resetPassword(input: ResetPasswordDto) {
    const token = input.token.trim();
    if (!token) {
      throw new BadRequestException('Mã khôi phục không hợp lệ hoặc đã hết hạn');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Mã khôi phục không hợp lệ hoặc đã hết hạn');
    }

    this.validatePasswordPolicy(input.newPassword);
    const newHash = await bcrypt.hash(input.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // Vô hiệu hóa toàn bộ token đặt lại mật khẩu của tài khoản này
      await tx.passwordResetToken.updateMany({
        where: { userId: resetRecord.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Cập nhật mật khẩu mới và tăng sessionVersion để vô hiệu hóa tất cả JWT cũ
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newHash,
          sessionVersion: { increment: 1 },
        },
      });
    });

    return {
      message:
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.',
    };
  }

  async changePassword(userId: string, input: ChangePasswordDto) {
    if (!userId) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
    }

    const matches = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    this.validatePasswordPolicy(input.newPassword);
    const newHash = await bcrypt.hash(input.newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          sessionVersion: { increment: 1 },
        },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  publicUser(user: {
    id: string;
    email: string;
    fullName: string;
    loyaltyPoints: number;
    role: Role;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      loyaltyPoints: user.loyaltyPoints,
      role: user.role,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  private validatePasswordPolicy(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có tối thiểu 8 ký tự');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Mật khẩu phải có chữ hoa');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Mật khẩu phải có chữ số');
    }
  }

  private signToken(userId: string, role: Role, sessionVersion: number) {
    // The strategy still loads the current role from the database on every request.
    return this.jwt.signAsync({ sub: userId, userId, role, sessionVersion });
  }
}

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email này đã được đăng ký');

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

  private signToken(userId: string, role: Role, sessionVersion: number) {
    // The strategy still loads the current role from the database on every request.
    return this.jwt.signAsync({ sub: userId, userId, role, sessionVersion });
  }
}

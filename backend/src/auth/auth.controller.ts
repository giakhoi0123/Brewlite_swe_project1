import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
});

const CUSTOMER_SESSION_COOKIE = 'brewlite_session';
const ADMIN_SESSION_COOKIE = 'brewlite_admin_session';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
    email: string;
    name: string;
    loyaltyPoints: number;
    role: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(input);
    response.cookie(CUSTOMER_SESSION_COOKIE, result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000,
    });
    return { user: result.user };
  }

  @Post('login')
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input);
    const cookieName =
      result.user.role === Role.ADMIN
        ? ADMIN_SESSION_COOKIE
        : CUSTOMER_SESSION_COOKIE;
    response.cookie(cookieName, result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000,
    });
    return { user: result.user };
  }

  @Post('forgot-password')
  @Header('Cache-Control', 'no-store')
  async forgotPassword(@Body() input: ForgotPasswordDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return this.auth.forgotPassword(input, ip);
  }

  @Post('reset-password')
  @Header('Cache-Control', 'no-store')
  async resetPassword(@Body() input: ResetPasswordDto) {
    return this.auth.resetPassword(input);
  }

  @Post('change-password')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: Request & { user: { userId: string } },
    @Body() input: ChangePasswordDto,
  ) {
    return this.auth.changePassword(request.user.userId, input);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  me(
    @Req()
    request: AuthenticatedRequest,
  ) {
    const { userId, email, name, loyaltyPoints, role } = request.user;
    return { user: { id: userId, email, name, loyaltyPoints, role } };
  }

  @Get('admin/me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminMe(@Req() request: AuthenticatedRequest) {
    const { userId, email, name, loyaltyPoints, role } = request.user;
    return { user: { id: userId, email, name, loyaltyPoints, role } };
  }

  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() request: Request & { user: { userId: string } },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.user.userId);
    response.clearCookie(CUSTOMER_SESSION_COOKIE, cookieOptions());
    return { message: 'Đã đăng xuất' };
  }

  @Post('admin/logout')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminLogout(@Res({ passthrough: true }) response: Response) {
    // The shared demo Admin account must not invalidate other members' sessions.
    response.clearCookie(ADMIN_SESSION_COOKIE, cookieOptions());
    return { message: 'Đã đăng xuất quản trị' };
  }
}

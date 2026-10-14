import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api',
});
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(input);
    response.cookie('brewlite_session', result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000,
    });
    return { user: result.user };
  }
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input);
    response.cookie('brewlite_session', result.accessToken, {
      ...cookieOptions(),
      maxAge: 86400000,
    });
    return { user: result.user };
  }
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @Req()
    request: Request & {
      user: {
        userId: string;
        email: string;
        name: string;
        loyaltyPoints: number;
        role: string;
      };
    },
  ) {
    const { userId, email, name, loyaltyPoints, role } = request.user;
    return { user: { id: userId, email, name, loyaltyPoints, role } };
  }
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('brewlite_session', cookieOptions());
    return { message: 'Đã đăng xuất' };
  }
}

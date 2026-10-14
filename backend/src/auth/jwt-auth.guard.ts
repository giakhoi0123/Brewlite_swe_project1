import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(error: unknown, user: TUser | false): TUser {
    if (error || !user)
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      );
    return user;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  handleRequest<TUser = any>(error: unknown, user: TUser | false): TUser {
    if (error || !user)
      throw new UnauthorizedException(
        'Phiên quản trị đã hết hạn hoặc không hợp lệ',
      );
    return user;
  }
}

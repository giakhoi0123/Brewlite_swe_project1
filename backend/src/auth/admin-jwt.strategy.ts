import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

const adminCookieExtractor = (request: {
  headers?: { cookie?: string };
}): string | null => {
  const cookie = request?.headers?.cookie
    ?.split('; ')
    .find((part) => part.startsWith('brewlite_admin_session='));
  return cookie ? cookie.slice('brewlite_admin_session='.length) : null;
};

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: adminCookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub?: string; sessionVersion?: number }) {
    if (!payload.sub)
      throw new UnauthorizedException('Phiên quản trị không hợp lệ');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      user.role !== Role.ADMIN ||
      user.status !== UserStatus.ACTIVE ||
      (payload.sessionVersion ?? 0) !== user.sessionVersion
    )
      throw new UnauthorizedException('Phiên quản trị đã hết hạn');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
      loyaltyPoints: user.loyaltyPoints,
    };
  }
}

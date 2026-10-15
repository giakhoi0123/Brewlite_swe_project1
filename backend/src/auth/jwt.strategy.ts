import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';

const cookieExtractor = (request: {
  headers?: { cookie?: string };
}): string | null => {
  const cookie = request?.headers?.cookie
    ?.split('; ')
    .find((part) => part.startsWith('brewlite_session='));
  return cookie ? cookie.slice('brewlite_session='.length) : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub?: string; sessionVersion?: number }) {
    if (!payload.sub)
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      (payload.sessionVersion ?? 0) !== user.sessionVersion
    )
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.fullName,
      loyaltyPoints: user.loyaltyPoints,
    };
  }
}

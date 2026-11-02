import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/types';

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
  squadIds: string[];
  typ?: 'access' | 'refresh';
}

/**
 * Validates the access token (15m) and rehydrates live squad memberships,
 * keeping ABAC checks current after roster swaps.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.typ === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used as access token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { squadMemberships: { where: { leftAt: null } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account suspended or removed');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      squadIds: user.squadMemberships.map((m) => m.squadId),
    };
  }
}

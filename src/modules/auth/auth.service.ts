import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { isAllowedEmailDomain } from '../../common/types';

/**
 * Authentication engine (security.md §2): bcrypt(12) password hashing,
 * 15-minute access JWTs, 7-day refresh JWTs with rotation + reuse detection.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async issueTokens(user: { id: string; email: string; role: string; squadIds: string[] }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      squadIds: user.squadIds,
      typ: 'access',
    });

    // jti guarantees uniqueness even when two tokens are issued in the same second,
    // otherwise an identical refresh JWT could be replayed as "the new" token.
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, typ: 'refresh', jti: randomUUID() },
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' },
    );

    // bcrypt silently truncates input at 72 bytes; JWTs are longer, so two different
    // tokens sharing a header+sub prefix would compare EQUAL. Pre-hash with SHA-256
    // (64 hex chars) so every distinct token yields a distinct bcrypt digest.
    const refreshTokenHash = await bcrypt.hash(createHash('sha256').update(refreshToken).digest('hex'), 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash } });

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!isAllowedEmailDomain(normalizedEmail)) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Only @seu.edu.bd email addresses are authorized to log in.');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { squadMemberships: { where: { leftAt: null } }, account: true },
    });
    if (!user || !user.isActive) {
      throw new AppException('AUTH_INVALID_CREDENTIALS');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new AppException('AUTH_INVALID_CREDENTIALS');
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      squadIds: user.squadMemberships.map((m) => m.squadId),
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        squadIds: user.squadMemberships.map((m) => m.squadId),
        walletBalance: user.account ? Number(user.account.balance) : 0,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new AppException('AUTH_TOKEN_EXPIRED');
    }
    if (payload.typ !== 'refresh') {
      throw new AppException('AUTH_TOKEN_REVOKED', 'Not a refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { squadMemberships: { where: { leftAt: null } } },
    });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new AppException('AUTH_TOKEN_REVOKED');
    }

    const tokenDigest = createHash('sha256').update(refreshToken).digest('hex');
    const matches = await bcrypt.compare(tokenDigest, user.refreshTokenHash);
    if (!matches) {
      // Token theft detected → revoke the whole family + CRITICAL audit entry (security.md §2.2)
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      await this.prisma.executiveAuditLog.create({
        data: {
          executiveId: user.id,
          executiveRole: user.role,
          actionType: 'REFRESH_TOKEN_REUSE_DETECTED',
          payloadSnapshot: { userId: user.id, at: new Date().toISOString() },
          riskSeverity: 'CRITICAL',
        },
      });
      throw new AppException('AUTH_TOKEN_REVOKED', 'Refresh token reuse detected. All sessions revoked.');
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      squadIds: user.squadMemberships.map((m) => m.squadId),
    });
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });
    return { loggedOut: true };
  }
}

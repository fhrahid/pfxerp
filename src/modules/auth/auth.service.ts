import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { isAllowedEmailDomain } from '../../common/types';
import { MailService } from '../mail/mail.service';

/**
 * Authentication engine (security.md §2): bcrypt(12) password hashing,
 * 15-minute access JWTs, 7-day refresh JWTs with rotation + reuse detection,
 * and secure transactional forgot/reset password flows.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
  ) {}

  async issueTokens(user: { id: string; email: string; role: string; squadIds: string[] }) {
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
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any },
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

    try {
      const roleForAudit = (Object.values(UserRole).includes(user.role as any) ? user.role : 'DEVELOPER') as UserRole;
      await this.prisma.executiveAuditLog.create({
        data: {
          executiveId: user.id,
          executiveRole: roleForAudit,
          actionType: 'USER_LOGIN',
          riskSeverity: 'INFO',
          payloadSnapshot: { email: user.email, timestamp: new Date().toISOString() },
        },
      });
    } catch {
      // Non-blocking login audit
    }

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
          executiveRole: Object.values(UserRole).includes(user.role as any)
            ? (user.role as UserRole)
            : UserRole.CEO,
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

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new AppException('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new AppException('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    if (currentPassword === newPassword) throw new AppException('VALIDATION_FAILED', 'Choose a different password');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, refreshTokenHash: null } });
    return { success: true, message: 'Password changed. Sign in again on other devices.' };
  }

  /**
   * Generates a 60-minute password reset link and sends via MailService / Resend.
   * Returns identical generic response regardless of whether the email exists to prevent enumeration.
   */
  async forgotPassword(email: string, testSecretKey?: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    const genericResponse = {
      success: true,
      message: 'If an account matches that email address, a password reset link has been dispatched.',
    };

    if (!isAllowedEmailDomain(normalizedEmail)) {
      return genericResponse;
    }

    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Invalidate existing unused password reset tokens for this user
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate 32-byte (64 hex characters) crypto-secure token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresInMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_IN_MINUTES) || 60;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/#reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      expiresInMinutes,
    });

    // SEC-03: Never leak reset URLs in public unauthenticated responses.
    // Only return resetUrl when validated by internal server ledger secret in automated testing environments.
    const isAuthorizedTest =
      testSecretKey &&
      process.env.LEDGER_SECRET_KEY &&
      testSecretKey === process.env.LEDGER_SECRET_KEY &&
      process.env.NODE_ENV !== 'production';

    return {
      ...genericResponse,
      ...(isAuthorizedTest ? { resetUrl } : {}),
    };
  }

  /**
   * Verifies reset token, updates password, and revokes all active refresh tokens for session security.
   */
  async resetPassword(token: string, newPassword: string) {
    if (!token || typeof token !== 'string') {
      throw new AppException('AUTH_INVALID_TOKEN', 'Reset token is required.');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new AppException('VALIDATION_FAILED', 'Password must be at least 8 characters long.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetRecord = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.usedAt !== null) {
      throw new AppException('AUTH_INVALID_TOKEN', 'Password reset link is invalid or has already been used.');
    }

    if (resetRecord.expiresAt < new Date()) {
      throw new AppException('AUTH_TOKEN_EXPIRED', 'Password reset link has expired. Please request a new one.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      // 1. Atomic token consumption check: prevents concurrent race conditions
      const consumeRes = await tx.passwordReset.updateMany({
        where: { id: resetRecord.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumeRes.count === 0) {
        throw new AppException('AUTH_INVALID_TOKEN', 'Password reset link is invalid or has already been used.');
      }

      // 2. Update user password and revoke all active sessions
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          refreshTokenHash: null, // Forces re-authentication across all devices
        },
      });
    });

    this.logger.log(`Password reset successfully executed for user ${resetRecord.user.email}`);

    return {
      success: true,
      message: 'Password has been reset successfully. You may now log in with your new password.',
    };
  }
}

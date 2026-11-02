import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from '../auth/auth.service';
import { RolesService } from '../roles/roles.service';
import { AppException } from '../../common/exceptions/app.exception';
import { AuthUser, isAllowedEmailDomain, isExecRole } from '../../common/types';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * C-Level only: creates and dispatches a 72-hour invitation link to a developer's email.
   */
  async createInvitation(inviter: AuthUser, dto: CreateInvitationDto) {
    if (!isExecRole(inviter.role)) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only C-Level executives (CEO, CFO, CTO, CPO) are authorized to send invitations.');
    }

    const email = dto.email.trim().toLowerCase();
    if (!isAllowedEmailDomain(email)) {
      throw new AppException('VALIDATION_FAILED', 'Invitations may only be sent to institutional @seu.edu.bd email addresses.');
    }

    // Check if an active account already exists
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingUser) {
      throw new AppException('CONFLICT', `A user with email ${email} already exists.`);
    }

    // Invalidate any previously pending invitations for this email address
    await this.prisma.invitation.updateMany({
      where: { email, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    const requestedRole = (dto.role || 'DEVELOPER').trim().toUpperCase();

    // Verify role exists in system (system role or custom role created by CEO)
    const roleRecord = await this.rolesService.findByName(requestedRole);
    if (!roleRecord) {
      throw new AppException(
        'VALIDATION_FAILED',
        `Role '${requestedRole}' does not exist in the system. The CEO must create this role before dispatching invitations.`,
      );
    }
    const role = roleRecord.name;

    // Hierarchical RBAC:
    // CEO can invite ANY role (including new roles created by CEO)
    // Other C-level executives (CFO, CTO, CPO) can ONLY invite PM and DEVELOPER
    if (inviter.role !== UserRole.CEO) {
      if (role !== 'DEVELOPER' && role !== 'PM') {
        throw new AppException(
          'AUTHZ_FORBIDDEN',
          'Only the CEO can dispatch invitations for executive and custom roles. Other C-level executives may only invite PM and DEVELOPER roles.',
        );
      }
    }

    const expiresInHours = Number(process.env.INVITATION_EXPIRES_IN_HOURS) || 72;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Cryptographically secure 32-byte raw token
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.invitation.create({
      data: {
        email,
        role,
        tokenHash,
        expiresAt,
        invitedById: inviter.id,
        targetSquadId: dto.targetSquadId || null,
        status: 'PENDING',
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/#accept-invite?token=${rawToken}`;

    const inviterRecord = await this.prisma.user.findUnique({
      where: { id: inviter.id },
      select: { fullName: true, role: true },
    });
    const inviterName = inviterRecord?.fullName || `${inviter.role} Executive`;

    await this.mailService.sendInvitationEmail({
      to: email,
      inviteUrl,
      inviterName,
      role,
      expiresInHours,
    });

    this.logger.log(`Invitation created for ${email} by ${inviter.email} (expires at ${expiresAt.toISOString()})`);

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      targetSquadId: invitation.targetSquadId,
      ...(process.env.NODE_ENV !== 'production' ? { inviteUrl, rawToken } : {}),
    };
  }

  /**
   * C-Level only: list all sent invitations with live expiration status.
   */
  async listInvitations(user: AuthUser) {
    if (!isExecRole(user.role)) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only C-Level executives are authorized to view invitations.');
    }

    // Auto-expire outdated pending records
    await this.prisma.invitation.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    const invitations = await this.prisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt,
      targetSquadId: inv.targetSquadId,
      invitedBy: inv.invitedBy,
    }));
  }

  /**
   * C-Level only: resend an invitation with a fresh 72-hour expiration window.
   */
  async resendInvitation(inviter: AuthUser, id: string) {
    if (!isExecRole(inviter.role)) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only C-Level executives are authorized to resend invitations.');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      include: { invitedBy: true },
    });

    if (!invitation) {
      throw new AppException('NOT_FOUND', 'Invitation not found.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new AppException('CONFLICT', 'This invitation has already been accepted and the account is active.');
    }

    const expiresInHours = Number(process.env.INVITATION_EXPIRES_IN_HOURS) || 72;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: {
        tokenHash,
        expiresAt,
        status: 'PENDING',
        invitedById: inviter.id,
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/#accept-invite?token=${rawToken}`;

    const inviterRecord = await this.prisma.user.findUnique({
      where: { id: inviter.id },
      select: { fullName: true, role: true },
    });
    const inviterName = inviterRecord?.fullName || `${inviter.role} Executive`;

    await this.mailService.sendInvitationEmail({
      to: updated.email,
      inviteUrl,
      inviterName,
      role: updated.role,
      expiresInHours,
    });

    this.logger.log(`Invitation ${id} resent to ${updated.email} by ${inviter.email}`);

    return {
      success: true,
      message: 'Invitation resent successfully with a renewed 72-hour validity window.',
      id: updated.id,
      email: updated.email,
      expiresAt: updated.expiresAt,
      ...(process.env.NODE_ENV !== 'production' ? { inviteUrl, rawToken } : {}),
    };
  }

  /**
   * C-Level only: revoke a pending invitation.
   */
  async revokeInvitation(inviter: AuthUser, id: string) {
    if (!isExecRole(inviter.role)) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only C-Level executives are authorized to revoke invitations.');
    }

    const invitation = await this.prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      throw new AppException('NOT_FOUND', 'Invitation not found.');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new AppException('CONFLICT', 'Cannot revoke an invitation that has already been accepted.');
    }

    await this.prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED' },
    });

    return { success: true, message: 'Invitation successfully revoked.' };
  }

  /**
   * Public: verify token validity before presenting setup form.
   */
  async verifyInvitation(token: string) {
    if (!token || typeof token !== 'string') {
      throw new AppException('AUTH_INVALID_TOKEN', 'Invitation token is missing or invalid.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED')) {
      throw new AppException('AUTH_INVALID_TOKEN', 'This invitation link is invalid or has already been used.');
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
      if (invitation.status !== 'EXPIRED') {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new AppException('AUTH_TOKEN_EXPIRED', 'This invitation link expired after 72 hours. Please contact studio leadership to receive a new invite.');
    }

    return {
      valid: true,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      targetSquadId: invitation.targetSquadId,
    };
  }

  /**
   * Public: accept invitation, set developer password, provision personal wallet,
   * attach squad membership (if specified), and auto-login with JWT tokens.
   */
  async acceptInvitation(dto: AcceptInvitationDto) {
    const { token, password, fullName, studentId } = dto;
    if (!token || typeof token !== 'string') {
      throw new AppException('AUTH_INVALID_TOKEN', 'Invitation token is required.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED')) {
      throw new AppException('AUTH_INVALID_TOKEN', 'This invitation link is invalid or has already been used.');
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt < new Date()) {
      if (invitation.status !== 'EXPIRED') {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new AppException('AUTH_TOKEN_EXPIRED', 'This invitation link has expired (72-hour validity exceeded). Please ask leadership to resend.');
    }

    const email = invitation.email.trim().toLowerCase();
    if (!isAllowedEmailDomain(email)) {
      throw new AppException('VALIDATION_FAILED', 'Account email must be an @seu.edu.bd address.');
    }

    // Verify existing email clash prior to password hashing
    const emailClash = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (emailClash) {
      throw new AppException('CONFLICT', `An account with email ${email} already exists.`);
    }

    // Verify studentId clash if given
    const trimmedStudentId = studentId?.trim() || null;
    if (trimmedStudentId) {
      const clash = await this.prisma.user.findUnique({ where: { studentId: trimmedStudentId } });
      if (clash) throw new AppException('CONFLICT', `Student ID ${trimmedStudentId} is already associated with another account.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Atomic execution of user registration, wallet creation, squad binding and invite consumption
    const user = await this.prisma.$transaction(async (tx) => {
      // 1. Atomic token consumption check: prevents race condition on concurrent submissions
      const consumeRes = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      if (consumeRes.count === 0) {
        throw new AppException('AUTH_INVALID_TOKEN', 'This invitation link is invalid or has already been used.');
      }

      const createdUser = await tx.user.create({
        data: {
          email,
          fullName: fullName.trim(),
          passwordHash,
          role: invitation.role,
          studentId: trimmedStudentId,
          isActive: true,
        },
      });

      // Provision PERSONAL_WALLET per studio protocol (BR-DEV-14)
      await tx.account.create({
        data: {
          ownerId: createdUser.id,
          type: 'PERSONAL_WALLET',
          balance: 0,
          currency: 'BDT',
        },
      });

      // Bind squad membership if pre-assigned
      if (invitation.targetSquadId) {
        const squad = await tx.squad.findUnique({ where: { id: invitation.targetSquadId } });
        if (squad) {
          await tx.squadMembership.create({
            data: {
              userId: createdUser.id,
              squadId: squad.id,
              role: invitation.role === 'PM' ? 'PM' : 'DEVELOPER',
              allocation: 1.0,
              isPrimary: true,
            },
          });
        }
      }

      return createdUser;
    });

    this.logger.log(`Developer account successfully activated for ${user.email} (Role: ${user.role})`);

    // Fetch squad memberships for token issuance
    const squadMemberships = await this.prisma.squadMembership.findMany({
      where: { userId: user.id, leftAt: null },
      select: { squadId: true },
    });

    const tokens = await this.authService.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      squadIds: squadMemberships.map((m) => m.squadId),
    });

    return {
      message: 'Developer account activated successfully. Welcome to Pointfex!',
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        squadIds: squadMemberships.map((m) => m.squadId),
        walletBalance: 0,
      },
    };
  }
}

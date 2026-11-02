import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { isAllowedEmailDomain } from '../../common/types';

export interface CreateUserDto {
  email: string;
  fullName: string;
  password: string;
  role: string;
  studentId?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  email?: string;
  role?: string;
  studentId?: string | null;
  isActive?: boolean;
  password?: string;
}

/**
 * People operations (chro.md §2.1): CPO/CEO create user profiles (with an
 * auto-provisioned personal wallet) and manage them — role changes, renaming,
 * password resets and (de)activation.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private safe(user: { id: string; email: string; fullName: string; role: string; studentId: string | null; isActive: boolean }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      studentId: user.studentId,
      isActive: user.isActive,
      hasPassword: true,
    };
  }

  async createUser(dto: CreateUserDto, caller?: { role: string }) {
    const email = dto.email.trim().toLowerCase();
    if (!isAllowedEmailDomain(email)) {
      throw new AppException('VALIDATION_FAILED', 'Email must be an @seu.edu.bd address');
    }

    const roleName = (dto.role || 'DEVELOPER').trim().toUpperCase();
    const roleExists = await this.prisma.role.findFirst({
      where: { name: { equals: roleName, mode: 'insensitive' } },
    });
    if (!roleExists) {
      throw new AppException('VALIDATION_FAILED', `Role '${dto.role}' does not exist.`);
    }

    if (caller && caller.role !== UserRole.CEO) {
      if (roleExists.name !== 'DEVELOPER' && roleExists.name !== 'PM') {
        throw new AppException('AUTHZ_FORBIDDEN', 'Only the CEO can assign executive or custom roles.');
      }
    }

    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new AppException('CONFLICT', `A user with email ${email} already exists`);
    // Blank student IDs become NULL — Postgres UNIQUE allows many NULLs but only one ''
    const studentId = dto.studentId?.trim() || null;
    if (studentId) {
      const clash = await this.prisma.user.findUnique({ where: { studentId } });
      if (clash) throw new AppException('CONFLICT', `Student ID ${studentId} is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName,
        passwordHash,
        role: roleExists.name,
        studentId,
        isActive: true,
      },
    });

    // Every user gets a PERSONAL_WALLET at enrollment (BR-DEV-14)
    await this.prisma.account.create({
      data: { ownerId: user.id, type: 'PERSONAL_WALLET', balance: 0, currency: 'BDT' },
    });

    return this.safe(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto, caller?: { role: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let assignedRole: string | undefined = undefined;
    if (dto.role) {
      const roleName = dto.role.trim().toUpperCase();
      const roleExists = await this.prisma.role.findFirst({
        where: { name: { equals: roleName, mode: 'insensitive' } },
      });
      if (!roleExists) {
        throw new AppException('VALIDATION_FAILED', `Role '${dto.role}' does not exist.`);
      }
      if (caller && caller.role !== UserRole.CEO) {
        if (roleExists.name !== 'DEVELOPER' && roleExists.name !== 'PM') {
          throw new AppException('AUTHZ_FORBIDDEN', 'Only the CEO can assign executive or custom roles.');
        }
      }
      assignedRole = roleExists.name;
    }

    // Blank student IDs become NULL — Postgres UNIQUE allows many NULLs but only one ''
    const studentId = dto.studentId === undefined ? undefined : dto.studentId?.trim() || null;
    const email = dto.email !== undefined ? dto.email.trim().toLowerCase() : undefined;

    if (email && email !== user.email.toLowerCase()) {
      if (!isAllowedEmailDomain(email)) {
        throw new AppException('VALIDATION_FAILED', 'Email must be an @seu.edu.bd address');
      }
      const clash = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (clash) throw new AppException('CONFLICT', `A user with email ${email} already exists`);
    }
    if (studentId && studentId !== user.studentId) {
      const clash = await this.prisma.user.findUnique({ where: { studentId } });
      if (clash) throw new AppException('CONFLICT', `Student ID ${studentId} is already taken`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(assignedRole ? { role: assignedRole } : {}),
        ...(studentId !== undefined ? { studentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 12) } : {}),
        // password change or deactivation invalidates all refresh sessions
        ...(dto.password || dto.isActive === false ? { refreshTokenHash: null } : {}),
      },
    });

    if (caller) {
      try {
        const callerRole = (Object.values(UserRole).includes(caller.role as any) ? caller.role : 'CPO') as UserRole;
        await this.prisma.executiveAuditLog.create({
          data: {
            executiveId: (caller as any).id || userId,
            executiveRole: callerRole,
            actionType: 'USER_PROFILE_UPDATED',
            riskSeverity: dto.isActive === false ? 'WARNING' : 'INFO',
            payloadSnapshot: {
              targetUserId: userId,
              updatedFields: Object.keys(dto).filter((k) => (dto as any)[k] !== undefined && k !== 'password'),
              passwordChanged: Boolean(dto.password),
              isActive: dto.isActive,
              role: assignedRole,
            },
          },
        });
      } catch {
        // Non-blocking audit log
      }
    }

    return this.safe(updated);
  }

  /**
   * Detailed profile view including work history, performance metrics (DPI/PMHI),
   * and missed deadline / overdue tracking.
   */
  async getUserProfile(userId: string, includeWalletBalance: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        account: true,
        squadMemberships: {
          where: { leftAt: null },
          select: {
            squadId: true,
            role: true,
            allocation: true,
            squad: { select: { id: true, name: true, healthStatus: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [assignedTasks, createdTasks, dpiSnapshots, pmhiSnapshots, citations] = await Promise.all([
      this.prisma.task.findMany({
        where: { assignedToId: userId },
        include: {
          squad: { select: { id: true, name: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 100,
      }),
      this.prisma.task.findMany({
        where: { assignedById: userId },
        include: {
          squad: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.developerPerformanceSnapshot.findMany({
        where: { userId },
        orderBy: { sprintNumber: 'desc' },
        take: 10,
      }),
      this.prisma.pmPerformanceSnapshot.findMany({
        where: { userId },
        orderBy: { sprintNumber: 'desc' },
        take: 10,
      }),
      this.prisma.codeAuditCitation.findMany({
        where: {
          squad: {
            memberships: { some: { userId, leftAt: null } },
          },
        },
        include: { squad: { select: { id: true, name: true } } },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = new Date();
    let totalAssigned = assignedTasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let overdueTasksCount = 0;
    let storyPointsAssigned = 0;
    let storyPointsCompleted = 0;
    let onTimeDeliveryCount = 0;

    const missedDeadlineTasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      storyPoints: number;
      dueDate: Date;
      completionTime?: Date | null;
      squadName?: string;
      isCurrentlyOverdue: boolean;
      daysOverdue: number;
    }> = [];

    for (const t of assignedTasks) {
      const sp = t.storyPoints || 0;
      storyPointsAssigned += sp;
      const isCompleted = t.status === 'CTO_VERIFIED' || t.status === 'CLOSED';

      if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (!isCompleted) {
          if (due < now) {
            overdueTasksCount++;
            missedDeadlineTasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              storyPoints: t.storyPoints,
              dueDate: t.dueDate,
              squadName: t.squad?.name,
              isCurrentlyOverdue: true,
              daysOverdue: Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)),
            });
          }
        } else {
          // Completed task - check if completed late
          const completionTime = t.ctoVerifiedAt || t.flaggedCompleteAt;
          if (completionTime && new Date(completionTime) > due) {
            overdueTasksCount++;
            missedDeadlineTasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              storyPoints: t.storyPoints,
              dueDate: t.dueDate,
              completionTime,
              squadName: t.squad?.name,
              isCurrentlyOverdue: false,
              daysOverdue: Math.ceil((new Date(completionTime).getTime() - due.getTime()) / (1000 * 60 * 60 * 24)),
            });
          } else {
            onTimeDeliveryCount++;
          }
        }
      }

      if (isCompleted) {
        completedTasks++;
        storyPointsCompleted += sp;
      } else {
        inProgressTasks++;
      }
    }

    const latestDpi = dpiSnapshots[0]?.dpiScore ? Number(dpiSnapshots[0].dpiScore) : null;
    const latestPmhi = pmhiSnapshots[0]?.pmhiScore ? Number(pmhiSnapshots[0].pmhiScore) : null;
    const onTimeRate = completedTasks > 0 ? Math.round((onTimeDeliveryCount / completedTasks) * 100) : 100;

    // Role-specific metrics for PMs, Developers, and C-Level Executives
    let executiveAuditLogs: any[] = [];
    let executiveDetails: any = null;
    let slackerFines: any[] = [];
    let pmDetails: any = null;

    if (user.role === 'DEVELOPER') {
      slackerFines = await this.prisma.ledgerTransaction.findMany({
        where: { referenceType: 'SLACKER_FINE', referenceId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, description: true, createdAt: true },
      });
    }

    if (user.role === 'PM') {
      const [pmVerifiedTasks, pmPayrolls] = await Promise.all([
        this.prisma.task.findMany({
          where: { pmVerifiedById: userId },
          select: { id: true, title: true, pmIsFlagPremature: true, pmPenaltyPoints: true, pmVerifiedAt: true },
          orderBy: { pmVerifiedAt: 'desc' },
          take: 50,
        }),
        this.prisma.payrollProposal.findMany({
          where: { submittedById: userId },
          select: { id: true, labNumber: true, totalProposed: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
      pmDetails = {
        verifiedCount: pmVerifiedTasks.filter((t) => !t.pmIsFlagPremature).length,
        rejectedCount: pmVerifiedTasks.filter((t) => t.pmIsFlagPremature).length,
        recentVerifications: pmVerifiedTasks.slice(0, 10),
        payrollsSubmitted: pmPayrolls,
      };
    }

    if (['CFO', 'CTO', 'CPO', 'CEO'].includes(user.role)) {
      executiveAuditLogs = await this.prisma.executiveAuditLog.findMany({
        where: { executiveId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      if (user.role === 'CFO') {
        const [loans, payouts, equity] = await Promise.all([
          this.prisma.loan.findMany({
            where: { approvedById: userId },
            include: { borrowerSquad: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 15,
          }),
          this.prisma.sprintPayout.findMany({
            where: { proposedById: userId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
          this.prisma.equityStake.findMany({
            where: { investorId: userId },
            include: { squad: { select: { id: true, name: true } } },
            take: 10,
          }),
        ]);
        executiveDetails = {
          loansApproved: loans,
          sprintPayouts: payouts,
          equityHoldings: equity,
        };
      } else if (user.role === 'CTO') {
        const [citationsIssued, reviewsCount, consultancies] = await Promise.all([
          this.prisma.codeAuditCitation.findMany({
            where: { citedById: userId },
            include: { squad: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          this.prisma.task.count({ where: { ctoVerifiedById: userId } }),
          this.prisma.consultancyBooking.findMany({
            where: { consultantId: userId },
            include: { clientSquad: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 15,
          }),
        ]);
        executiveDetails = {
          citationsIssued,
          tasksReviewedCount: reviewsCount,
          consultancies,
        };
      } else if (user.role === 'CPO') {
        const [approvedPayrolls, noticesDispatched] = await Promise.all([
          this.prisma.payrollProposal.findMany({
            where: { approvedById: userId },
            include: { squad: { select: { id: true, name: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 15,
          }),
          this.prisma.notice.findMany({
            where: { senderId: userId },
            include: { recipient: { select: { id: true, fullName: true, role: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
        ]);
        executiveDetails = {
          approvedPayrolls,
          noticesDispatched,
        };
      } else if (user.role === 'CEO') {
        const chaos = await this.prisma.chaosEvent.findMany({
          where: { triggeredById: userId },
          orderBy: { createdAt: 'desc' },
          take: 15,
        });
        executiveDetails = {
          chaosEvents: chaos,
        };
      }
    }

    return {
      ...this.safe(user),
      createdAt: user.createdAt,
      ...(includeWalletBalance ? { walletBalance: user.account ? Number(user.account.balance) : 0 } : {}),
      squadMemberships: user.squadMemberships,
      stats: {
        totalAssigned,
        completedTasks,
        inProgressTasks,
        overdueTasksCount,
        storyPointsAssigned,
        storyPointsCompleted,
        onTimeRate,
        latestDpi,
        latestPmhi,
        prematureFlagsCount: dpiSnapshots[0]?.prematureFlagsCount || 0,
      },
      assignedTasks,
      createdTasks,
      missedDeadlineTasks,
      dpiSnapshots,
      pmhiSnapshots,
      citations,
      slackerFines,
      pmDetails,
      executiveDetails,
      executiveAuditLogs,
    };
  }
}

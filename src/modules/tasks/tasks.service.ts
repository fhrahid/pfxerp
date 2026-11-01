import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { ChaosService } from '../chaos/chaos.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AuthUser, isExecRole, isBoardRole, isOverrideRole } from '../../common/types';

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ['TODO'],
  TODO: ['IN_PROGRESS', 'BACKLOG'],
  IN_PROGRESS: ['FLAGGED_COMPLETE', 'TODO'],
  FLAGGED_COMPLETE: ['PM_VERIFIED', 'IN_PROGRESS'],
  PM_VERIFIED: ['CTO_VERIFIED', 'IN_PROGRESS'],
  CTO_VERIFIED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

/**
 * Jira-like task engine with the anti-gaming state machine (pm.md §3, dev.md §2).
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly chaos: ChaosService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  private assertTransition(task: Task, to: TaskStatus) {
    if (!ALLOWED[task.status].includes(to)) {
      throw new BadRequestException(
        `TASK_INVALID_TRANSITION: cannot move from ${task.status} to ${to}`,
      );
    }
  }

  private async transition(
    task: Task,
    to: TaskStatus,
    changedById: string,
    comment?: string,
    extra: Partial<Task> = {},
  ): Promise<Task> {
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: to, ...extra } as any,
    });
    await this.prisma.taskAuditEvent.create({
      data: {
        taskId: task.id,
        changedById,
        fromStatus: task.status,
        toStatus: to,
        comment: comment ?? null,
      },
    });
    this.events.emitToRoom(this.events.squadRoom(task.squadId), 'task:status_changed', {
      taskId: task.id,
      fromStatus: task.status,
      toStatus: to,
      changedBy: changedById,
    });
    return updated;
  }

  private async sprintNumber(): Promise<number> {
    return this.settings.currentSprint();
  }

  // ---- DPI / PMHI true formula calculations (dev.md §6, pm.md §6) ----
  async recomputeDevDpi(userId: string, sprint?: number) {
    const sprintNumber = sprint ?? (await this.sprintNumber());
    const [tasks, snapshot] = await Promise.all([
      this.prisma.task.findMany({ where: { assignedToId: userId, sprintNumber } }),
      this.prisma.developerPerformanceSnapshot.findUnique({
        where: { userId_sprintNumber: { userId, sprintNumber } },
      }),
    ]);

    const prematureFlags = snapshot?.prematureFlagsCount || 0;
    const bugBounties = snapshot?.bugBountyContributions || 0;

    let assignedPoints = 0;
    let completedPoints = 0;
    let onTimeCount = 0;
    let completedCount = 0;
    let ctoPassCount = 0;
    let ctoReviewedCount = 0;

    for (const t of tasks) {
      const points = t.storyPoints || 0;
      assignedPoints += points;
      if (t.status === 'CTO_VERIFIED' || t.status === 'CLOSED') {
        completedPoints += points;
        completedCount++;
        if (!t.dueDate || (t.ctoVerifiedAt && t.ctoVerifiedAt <= t.dueDate) || (t.flaggedCompleteAt && t.flaggedCompleteAt <= t.dueDate)) {
          onTimeCount++;
        }
      }
      if (t.ctoVerifiedById) {
        ctoReviewedCount++;
        if (t.ctoQualityPassed) ctoPassCount++;
      }
    }

    const onTimeRate = completedCount > 0 ? onTimeCount / completedCount : 1.0;
    const ctoPassRate = ctoReviewedCount > 0 ? ctoPassCount / ctoReviewedCount : 1.0;
    const completionRatio = assignedPoints > 0 ? completedPoints / assignedPoints : (tasks.length === 0 ? 1.0 : 0.0);

    let score = assignedPoints === 0 && tasks.length === 0 && prematureFlags === 0
      ? 100
      : (completionRatio * 40) + (onTimeRate * 20) + (ctoPassRate * 25) - (prematureFlags * 15) + (bugBounties * 2);

    score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

    return this.prisma.developerPerformanceSnapshot.upsert({
      where: { userId_sprintNumber: { userId, sprintNumber } },
      update: {
        dpiScore: new Prisma.Decimal(score.toFixed(2)),
        storyPointsAssigned: assignedPoints,
        storyPointsCompleted: completedPoints,
        onTimeDeliveryRate: new Prisma.Decimal(onTimeRate.toFixed(2)),
        ctoQualityPassRate: new Prisma.Decimal(ctoPassRate.toFixed(2)),
        calculatedAt: new Date(),
      },
      create: {
        userId,
        sprintNumber,
        dpiScore: new Prisma.Decimal(score.toFixed(2)),
        storyPointsAssigned: assignedPoints,
        storyPointsCompleted: completedPoints,
        onTimeDeliveryRate: new Prisma.Decimal(onTimeRate.toFixed(2)),
        ctoQualityPassRate: new Prisma.Decimal(ctoPassRate.toFixed(2)),
        prematureFlagsCount: prematureFlags,
        bugBountyContributions: bugBounties,
      },
    });
  }

  async recomputePmPmhi(pmUserId: string, squadId: string, sprint?: number) {
    const sprintNumber = sprint ?? (await this.sprintNumber());
    const [tasks, snapshot] = await Promise.all([
      this.prisma.task.findMany({ where: { squadId, sprintNumber } }),
      this.prisma.pmPerformanceSnapshot.findUnique({
        where: { userId_sprintNumber: { userId: pmUserId, sprintNumber } },
      }),
    ]);

    const ctoOverrides = snapshot?.ctoOverrideCount || 0;
    let plannedPoints = 0;
    let completedPoints = 0;
    let onTimeCount = 0;
    let completedCount = 0;
    let ctoAgreedCount = 0;
    let pmApprovedCount = 0;

    for (const t of tasks) {
      const points = t.storyPoints || 0;
      plannedPoints += points;
      if (t.status === 'CTO_VERIFIED' || t.status === 'CLOSED') {
        completedPoints += points;
        completedCount++;
        if (!t.dueDate || (t.ctoVerifiedAt && t.ctoVerifiedAt <= t.dueDate) || (t.flaggedCompleteAt && t.flaggedCompleteAt <= t.dueDate)) {
          onTimeCount++;
        }
      }
      if (t.pmVerifiedById && t.ctoVerifiedById) {
        pmApprovedCount++;
        if (t.ctoQualityPassed) {
          ctoAgreedCount++;
        }
      }
    }

    const velocityAccuracy = plannedPoints > 0 ? Math.min(completedPoints / plannedPoints, 1.0) : 1.0;
    const ctoAgreementRate = pmApprovedCount > 0 ? ctoAgreedCount / pmApprovedCount : 1.0;
    const onTimeDeliveryRate = completedCount > 0 ? onTimeCount / completedCount : 1.0;

    let score = (velocityAccuracy * 35) + (ctoAgreementRate * 35) + (onTimeDeliveryRate * 30) - (ctoOverrides * 20);
    score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

    return this.prisma.pmPerformanceSnapshot.upsert({
      where: { userId_sprintNumber: { userId: pmUserId, sprintNumber } },
      update: {
        pmhiScore: new Prisma.Decimal(score.toFixed(2)),
        velocityAccuracy: new Prisma.Decimal(velocityAccuracy.toFixed(2)),
        ctoAgreementRate: new Prisma.Decimal(ctoAgreementRate.toFixed(2)),
        onTimeDeliveryRate: new Prisma.Decimal(onTimeDeliveryRate.toFixed(2)),
        calculatedAt: new Date(),
      },
      create: {
        userId: pmUserId,
        sprintNumber,
        pmhiScore: new Prisma.Decimal(score.toFixed(2)),
        velocityAccuracy: new Prisma.Decimal(velocityAccuracy.toFixed(2)),
        ctoAgreementRate: new Prisma.Decimal(ctoAgreementRate.toFixed(2)),
        onTimeDeliveryRate: new Prisma.Decimal(onTimeDeliveryRate.toFixed(2)),
        ctoOverrideCount: ctoOverrides,
      },
    });
  }

  async createTask(user: AuthUser, dto: {
    squadId: string;
    title: string;
    description?: string;
    storyPoints?: number;
    priority?: string;
    sprintNumber?: number;
    assignedToId?: string;
    dueDate?: string;
    clientMilestoneId?: string;
  }) {
    await this.assertPmOrExec(user, dto.squadId);

    const points = dto.storyPoints ?? 1;
    if (points < 1 || points > 13) throw new BadRequestException('Story points must be between 1 and 13');

    // BR-PM-01: TODO requires storyPoints + assignee; otherwise it lands in BACKLOG
    const canTodo = Boolean(dto.assignedToId && dto.sprintNumber);
    const status: TaskStatus = canTodo ? TaskStatus.TODO : TaskStatus.BACKLOG;

    const task = await this.prisma.task.create({
      data: {
        squadId: dto.squadId,
        title: dto.title,
        description: dto.description,
        storyPoints: points,
        priority: (dto.priority as any) || 'MEDIUM',
        sprintNumber: dto.sprintNumber,
        assignedToId: dto.assignedToId,
        assignedById: user.id,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        clientMilestoneId: dto.clientMilestoneId,
        status,
      },
    });

    if (task.assignedToId && task.sprintNumber) {
      await this.recomputeDevDpi(task.assignedToId, task.sprintNumber);
    }

    this.events.emitToRoom(this.events.squadRoom(task.squadId), 'task:created', {
      id: task.id,
      squadId: task.squadId,
      title: task.title,
      storyPoints: task.storyPoints,
      priority: task.priority,
    });
    return task;
  }

  async listTasks(user: AuthUser, filters: { squadId?: string; status?: TaskStatus; assignedToId?: string; sprintNumber?: number }) {
    const isExec = isExecRole(user.role);
    const where: any = {};
    if (filters.squadId) {
      if (!isExec && !user.squadIds.includes(filters.squadId)) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
      where.squadId = filters.squadId;
    } else if (!isExec) {
      where.squadId = { in: user.squadIds.length ? user.squadIds : ['none'] };
    }
    if (filters.status) where.status = filters.status;
    if (filters.sprintNumber) where.sprintNumber = filters.sprintNumber;
    if (filters.assignedToId === 'me') where.assignedToId = user.id;
    else if (filters.assignedToId) where.assignedToId = filters.assignedToId;

    return this.prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        squad: { select: { id: true, name: true } },
      },
    });
  }

  async getTask(user: AuthUser, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        squad: { select: { id: true, name: true } },
        auditEvents: { orderBy: { createdAt: 'desc' }, include: { changedBy: { select: { id: true, fullName: true, role: true } } } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    const isExec = isExecRole(user.role);
    if (!isExec && !user.squadIds.includes(task.squadId)) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
    return task;
  }

  private async assertPmOrExec(user: AuthUser, squadId: string) {
    if (isOverrideRole(user.role)) return;
    const m = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId, role: 'PM', leftAt: null },
    });
    if (!m) throw new ForbiddenException('Only the squad PM or an executive may manage this squad\'s tasks');
  }

  /** TODO -> IN_PROGRESS (BR-PM-02: assignee or squad PM only). */
  async startTask(user: AuthUser, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertTransition(task, TaskStatus.IN_PROGRESS);
    await this.chaos.assertNotLockedOut(user.id);
    if (task.assignedToId !== user.id) {
      await this.assertPmOrExec(user, task.squadId);
    }
    return this.transition(task, TaskStatus.IN_PROGRESS, user.id, 'Work started');
  }

  /** IN_PROGRESS -> FLAGGED_COMPLETE with mandatory git proof (BR-DEV-01..04). */
  async flagComplete(user: AuthUser, taskId: string, dto: { gitPrUrl?: string; gitCommitHash?: string }) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new BadRequestException('TASK_INVALID_TRANSITION: task must be IN_PROGRESS to flag complete');
    }
    if (task.assignedToId !== user.id) {
      throw new ForbiddenException('Only the assigned developer can flag completion');
    }
    await this.chaos.assertNotLockedOut(user.id);
    if (!dto.gitPrUrl && !dto.gitCommitHash) {
      throw new BadRequestException('TASK_MISSING_GIT_LINK: a valid PR URL or commit hash is required');
    }

    const flaggedAt = new Date();
    const commitTs = new Date(flaggedAt.getTime() - 1000); // commit must precede the flag
    return this.transition(
      task,
      TaskStatus.FLAGGED_COMPLETE,
      user.id,
      `Flagged complete with PR: ${dto.gitPrUrl || dto.gitCommitHash}`,
      {
        gitPrUrl: dto.gitPrUrl,
        gitCommitHash: dto.gitCommitHash,
        flaggedCompleteAt: flaggedAt,
        lastCommitTimestamp: commitTs,
      },
    );
  }

  /** FLAGGED_COMPLETE -> PM_VERIFIED (BR-PM-05). */
  async pmVerify(user: AuthUser, taskId: string, comment?: string) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status !== TaskStatus.FLAGGED_COMPLETE) {
      throw new BadRequestException('Task is not awaiting PM verification');
    }
    await this.assertPmOrExec(user, task.squadId);
    if (task.assignedToId === user.id) {
      throw new ForbiddenException('Self-verification conflict: escalate to CTO or peer PM (pm.md §9.1)');
    }
    const updated = await this.transition(task, TaskStatus.PM_VERIFIED, user.id, comment, {
      pmVerifiedById: user.id,
      pmVerifiedAt: new Date(),
      pmFeedback: comment,
      ctoVerifiedById: null,
      ctoVerifiedAt: null,
      ctoQualityPassed: null,
    });
    if (updated.assignedToId) {
      await this.recomputeDevDpi(updated.assignedToId, task.sprintNumber ?? undefined);
    }
    return updated;
  }

  /** FLAGGED_COMPLETE -> IN_PROGRESS with premature-flag penalty (BR-PM-04, BR-DEV-05..07). */
  async pmReject(user: AuthUser, taskId: string, dto: { isPremature: boolean; penaltyPoints?: number; feedback: string }) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status !== TaskStatus.FLAGGED_COMPLETE) {
      throw new BadRequestException('Task is not awaiting PM verification');
    }
    await this.assertPmOrExec(user, task.squadId);

    let penalty = dto.penaltyPoints ?? 15;
    penalty = Math.max(15, Math.min(50, penalty));

    const updated = await this.transition(task, TaskStatus.IN_PROGRESS, user.id, dto.feedback, {
      pmIsFlagPremature: dto.isPremature,
      pmPenaltyPoints: penalty,
      pmFeedback: dto.feedback,
      pmVerifiedById: null,
      pmVerifiedAt: null,
    });

    if (dto.isPremature && task.assignedToId) {
      const sprint = task.sprintNumber || (await this.sprintNumber());
      await this.prisma.developerPerformanceSnapshot.upsert({
        where: { userId_sprintNumber: { userId: task.assignedToId, sprintNumber: sprint } },
        update: { prematureFlagsCount: { increment: 1 } },
        create: { userId: task.assignedToId, sprintNumber: sprint, dpiScore: 85, prematureFlagsCount: 1 },
      });
      await this.recomputeDevDpi(task.assignedToId, sprint);
    }
    return { ...updated, penaltyDeducted: penalty };
  }

  /** PM_VERIFIED -> CTO_VERIFIED (BR-CTO-08..10). */
  async ctoVerify(user: AuthUser, taskId: string, dto: { critique?: string; testCoveragePercent?: number }) {
    const task = await this.getTaskOrThrow(taskId);
    if (task.status !== TaskStatus.PM_VERIFIED) {
      throw new BadRequestException('Task must be in PM_VERIFIED status for CTO audit');
    }
    // CTO conflict-of-interest check (cto.md §14.1)
    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId: task.squadId, leftAt: null },
    });
    if (membership) {
      throw new ForbiddenException('Conflict of interest: CTO holds active membership in this squad');
    }

    const updated = await this.transition(task, TaskStatus.CTO_VERIFIED, user.id, dto.critique, {
      ctoVerifiedById: user.id,
      ctoVerifiedAt: new Date(),
      ctoQualityPassed: true,
      ctoCritique: dto.critique,
    });

    if (updated.assignedToId) {
      await this.recomputeDevDpi(updated.assignedToId, task.sprintNumber ?? undefined);
    }
    if (task.pmVerifiedById) {
      await this.recomputePmPmhi(task.pmVerifiedById, task.squadId, task.sprintNumber ?? undefined);
    }
    return updated;
  }

  /** PM_VERIFIED -> IN_PROGRESS with squad fine + PMHI demerit (BR-CTO-11..14). */
  async ctoReject(user: AuthUser, taskId: string, dto: { critique: string; citationType: 'CODE_SMELL' | 'BAD_MERGE_REQUEST' | 'SECURITY_VULNERABILITY' }) {
    if (!dto.critique || dto.critique.length < 20) {
      throw new BadRequestException('CTO rejection critique must be at least 20 characters (BR-CTO-14)');
    }
    const task = await this.getTaskOrThrow(taskId);
    if (task.status !== TaskStatus.PM_VERIFIED) {
      throw new BadRequestException('Task must be in PM_VERIFIED status to reject');
    }
    const membership = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId: task.squadId, leftAt: null },
    });
    if (membership) {
      throw new ForbiddenException('Conflict of interest: CTO holds active membership in this squad');
    }

    const sprint = task.sprintNumber || (await this.sprintNumber());

    // 1. Automatic citation + fine (squad 2000 -> CTO 1000 + CFO 400 + reserve 600)
    await this.audit.issueCitation(
      user.id,
      {
        squadId: task.squadId,
        type: dto.citationType,
        description: `CTO Rejection on Task '${task.title}': ${dto.critique}`,
        taskId: task.id,
      },
      `ctoreject_${task.id}_${sprint}`,
    );

    // 2. Reset to IN_PROGRESS (transition task first so DB has updated status and ctoQualityPassed=false)
    const fine = await this.settings.getNumber('CODE_AUDIT_FINE', 2000);
    const updated = await this.transition(task, TaskStatus.IN_PROGRESS, user.id, dto.critique, {
      ctoVerifiedById: user.id,
      ctoVerifiedAt: new Date(),
      ctoQualityPassed: false,
      ctoFineLevied: new Prisma.Decimal(fine),
      ctoCritique: dto.critique,
    });

    // 3. PMHI rubber-stamp demerit (BR-CTO-13) & recompute scores on fresh state
    if (task.pmVerifiedById) {
      await this.prisma.pmPerformanceSnapshot.upsert({
        where: { userId_sprintNumber: { userId: task.pmVerifiedById, sprintNumber: sprint } },
        update: { ctoOverrideCount: { increment: 1 } },
        create: { userId: task.pmVerifiedById, sprintNumber: sprint, pmhiScore: 80, ctoOverrideCount: 1 },
      });
      await this.recomputePmPmhi(task.pmVerifiedById, task.squadId, sprint);
    }

    // 4. Recompute developer DPI on rejection
    if (task.assignedToId) {
      await this.recomputeDevDpi(task.assignedToId, sprint);
    }

    return updated;
  }

  /** CTO_VERIFIED -> CLOSED by PM or CTO. */
  async closeTask(user: AuthUser, taskId: string) {
    const task = await this.getTaskOrThrow(taskId);
    this.assertTransition(task, TaskStatus.CLOSED);
    await this.assertPmOrExec(user, task.squadId);
    const closed = await this.transition(task, TaskStatus.CLOSED, user.id, 'Merged & deployed');
    if (closed.assignedToId) {
      await this.recomputeDevDpi(closed.assignedToId, closed.sprintNumber ?? undefined);
    }
    if (closed.pmVerifiedById) {
      await this.recomputePmPmhi(closed.pmVerifiedById, closed.squadId, closed.sprintNumber ?? undefined);
    }
    return closed;
  }

  private async getTaskOrThrow(taskId: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /** CTO verification queue (API-CTO-06). */
  async pendingVerification(squadId?: string) {
    return this.prisma.task.findMany({
      where: { status: TaskStatus.PM_VERIFIED, ...(squadId ? { squadId } : {}) },
      include: {
        squad: { select: { id: true, name: true } },
        pmVerifiedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { pmVerifiedAt: 'asc' },
    });
  }
}

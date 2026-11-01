import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ChaosEvent, ChaosEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser } from '../../common/types';
import { UserRole } from '@prisma/client';

/**
 * CEO Chaos Injection Engine (ceo.md §3.2):
 *  - SCOPE_CREEP, LEAD_DEV_SICK_LEAVE (30-min Redis-style TTL lockout), SERVER_OUTAGE (timed auto-penalty), CUSTOM
 *  - broadcasts `chaos:triggered` studio-wide; unresolved timed events auto-fine the squad
 */
@Injectable()
export class ChaosService implements OnModuleInit, OnModuleDestroy {
  private lockouts = new Map<string, number>(); // userId -> unlock epoch ms
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly events: EventsGateway,
  ) {}

  onModuleInit() {
    // Sweeps overdue penalties every 30s (stand-in for the BullMQ delayed job in v2)
    this.sweeper = setInterval(() => {
      this.sweepDuePenalties().catch(() => undefined);
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /** TasksService calls this before any developer task mutation. */
  assertNotLockedOut(userId: string) {
    const until = this.lockouts.get(userId);
    if (until && until > Date.now()) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      throw new ForbiddenException(`TASK_USER_LOCKED: chaos lockout active for ${mins} more minute(s)`);
    }
    if (until) this.lockouts.delete(userId);
  }

  isLockedOut(userId: string) {
    const until = this.lockouts.get(userId);
    return Boolean(until && until > Date.now());
  }

  async trigger(user: AuthUser, dto: {
    type: ChaosEventType;
    title: string;
    description: string;
    targetSquadId?: string;
    targetUserId?: string;
    penaltyAmount?: number;
    timeLimitSeconds?: number;
  }): Promise<ChaosEvent> {
    if (dto.type === ChaosEventType.LEAD_DEV_SICK_LEAVE && !dto.targetUserId) {
      throw new BadRequestException('LEAD_DEV_SICK_LEAVE requires targetUserId');
    }
    if (dto.penaltyAmount && !dto.targetSquadId) {
      throw new BadRequestException('Penalty chaos events require targetSquadId');
    }

    const penaltyDueAt =
      dto.penaltyAmount && dto.timeLimitSeconds
        ? new Date(Date.now() + dto.timeLimitSeconds * 1000)
        : null;

    const event = await this.prisma.chaosEvent.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        targetSquadId: dto.targetSquadId,
        targetUserId: dto.targetUserId,
        penaltyAmount: dto.penaltyAmount ?? null,
        triggeredById: user.id,
        penaltyDueAt,
      },
    });

    // 1. Sick-leave lockout: 30 minutes (BR-CEO-07.2)
    if (dto.type === ChaosEventType.LEAD_DEV_SICK_LEAVE && dto.targetUserId) {
      this.lockouts.set(dto.targetUserId, Date.now() + 30 * 60 * 1000);
    }

    // 2. Broadcast studio-wide alarm (BR-CEO-08)
    this.events.emitToStudio('chaos:triggered', {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      targetSquadId: event.targetSquadId,
      penaltyAmount: event.penaltyAmount ? Number(event.penaltyAmount) : null,
      penaltyDueAt: event.penaltyDueAt,
      createdAt: event.createdAt,
    });

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: user.id,
        executiveRole: user.role,
        actionType: 'CHAOS_EVENT_TRIGGERED',
        payloadSnapshot: { eventId: event.id, type: event.type, targetSquadId: dto.targetSquadId } as any,
        riskSeverity: 'WARNING',
      },
    });

    return event;
  }

  async list(includeResolved = false) {
    return this.prisma.chaosEvent.findMany({
      where: includeResolved ? {} : { resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        targetSquad: { select: { id: true, name: true } },
        targetUser: { select: { id: true, fullName: true } },
      },
    });
  }

  /** Squad PM (or CEO) resolves an incident before the deadline (ceo.md §6.1). */
  async resolve(user: AuthUser, eventId: string, resolution: string) {
    const event = await this.prisma.chaosEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Chaos event not found');
    if (event.resolvedAt) throw new BadRequestException('Event already resolved');

    if (user.role !== UserRole.CEO && event.targetSquadId) {
      const isPM = await this.prisma.squadMembership.findFirst({
        where: { userId: user.id, squadId: event.targetSquadId, role: 'PM', leftAt: null },
      });
      if (!isPM) throw new ForbiddenException('Only the target squad PM or CEO may resolve this incident');
    }

    const updated = await this.prisma.chaosEvent.update({
      where: { id: eventId },
      data: { resolvedAt: new Date(), resolution },
    });

    if (event.targetUserId) this.lockouts.delete(event.targetUserId);

    this.events.emitToStudio('chaos:resolved', {
      id: updated.id,
      resolutionText: resolution,
      resolvedAt: updated.resolvedAt,
    });
    return updated;
  }

  /** Applies overdue penalties idempotently (BR-CEO-07.3). */
  private async sweepDuePenalties() {
    const due = await this.prisma.chaosEvent.findMany({
      where: {
        resolvedAt: null,
        penaltyDueAt: { not: null, lte: new Date() },
        penaltyAppliedAt: null,
        penaltyAmount: { not: null },
      },
      take: 20,
    });
    for (const event of due) {
      await this.applyPenalty(event).catch(() => undefined);
    }
  }

  async applyPenalty(event: ChaosEvent) {
    if (!event.targetSquadId || !event.penaltyAmount) return;
    const amount = Number(event.penaltyAmount);

    const treasury = await this.ledger.squadTreasury(event.targetSquadId);
    const reserve = await this.ledger.systemReserve();

    await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: treasury.id,
      recipientAccountId: reserve.id,
      amount,
      referenceType: 'CHAOS_PENALTY',
      referenceId: event.id,
      description: `Chaos penalty: ${event.title}`,
      idempotencyKey: `chaos_penalty_${event.id}`,
      authorizedById: event.triggeredById,
    });

    await this.prisma.chaosEvent.update({
      where: { id: event.id },
      data: { penaltyAppliedAt: new Date() },
    });

    this.events.emitToRoom(this.events.squadRoom(event.targetSquadId), 'chaos:penalty_applied', {
      eventId: event.id,
      amount,
    });
  }
}

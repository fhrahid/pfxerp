import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { EventsGateway } from '../../events/events.gateway';

/**
 * CTO Code Audit & Citation Engine (cto.md §3).
 * Settlement: SQUAD_TREASURY -(fine)-> CTO wallet (cut) + SYSTEM_RESERVE (remainder).
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
  ) {}

  async issueCitation(
    ctoUserId: string,
    dto: { squadId: string; type: string; description: string; taskId?: string; repositoryUrl?: string; commitHash?: string },
    idempotencyKey: string,
  ) {
    if (!dto.description || dto.description.length < 15) {
      throw new BadRequestException('Citation description must be at least 15 characters');
    }
    const squad = await this.prisma.squad.findUnique({ where: { id: dto.squadId } });
    if (!squad) throw new NotFoundException('Target squad not found');

    const fineAmount = await this.settings.getNumber('CODE_AUDIT_FINE', 2000);
    const ctoCut = await this.settings.getNumber('CTO_AUDIT_FINE_CUT', 1000);
    const cfoRate = await this.settings.getNumber('CFO_PENALTY_INCENTIVE', 0.20);
    const cfoUser = await this.prisma.user.findFirst({ where: { role: 'CFO', isActive: true } });
    const cfoCut = cfoUser ? Math.round(fineAmount * cfoRate * 100) / 100 : 0;
    const reserveCut = Math.round((fineAmount - ctoCut - cfoCut) * 100) / 100;
    if (fineAmount - ctoCut - cfoCut < 0) throw new BadRequestException('CODE_AUDIT_FINE must cover CTO and CFO cuts');

    const squadAcc = await this.ledger.squadTreasury(dto.squadId);
    const ctoAcc = await this.ledger.personalWallet(ctoUserId);
    const reserveAcc = await this.ledger.systemReserve();

    const entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[] = [
      { accountId: squadAcc.id, direction: 'DEBIT', amount: fineAmount },
      { accountId: ctoAcc.id, direction: 'CREDIT', amount: ctoCut },
    ];
    if (cfoCut > 0 && cfoUser) {
      const cfoAcc = await this.ledger.personalWallet(cfoUser.id);
      entries.push({ accountId: cfoAcc.id, direction: 'CREDIT', amount: cfoCut });
    }
    entries.push({ accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut });

    const tx = await this.ledger.postTransaction({
      entries,
      referenceType: 'CODE_AUDIT_FINE',
      referenceId: dto.taskId,
      description: `Code Audit Citation (${dto.type}) — ${dto.description.slice(0, 120)}`,
      idempotencyKey: idempotencyKey || `citation_${dto.squadId}_${Date.now()}`,
      authorizedById: ctoUserId,
    });

    const citation = await this.prisma.codeAuditCitation.create({
      data: {
        squadId: dto.squadId,
        citedById: ctoUserId,
        type: dto.type as any,
        description: dto.description,
        fineAmount,
        ctoCut,
        taskId: dto.taskId,
      },
    });

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: ctoUserId,
        executiveRole: 'CTO',
        actionType: 'ISSUE_CODE_AUDIT_CITATION',
        payloadSnapshot: { citationId: citation.id, squadId: dto.squadId, fineAmount, transactionId: tx.id } as any,
      },
    });

    this.events.emitToRoom(this.events.squadRoom(dto.squadId), 'cto:citation-issued', {
      citationId: citation.id,
      squadId: dto.squadId,
      fineAmount,
    });

    return { ...citation, transactionId: tx.id, systemReserveCut: reserveCut, cfoCut };
  }

  async listCitations(filters: { squadId?: string; type?: string; page: number; limit: number }) {
    const where: any = {};
    if (filters.squadId) where.squadId = filters.squadId;
    if (filters.type) where.type = filters.type;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.codeAuditCitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { squad: { select: { id: true, name: true } }, citedBy: { select: { id: true, fullName: true } } },
      }),
      this.prisma.codeAuditCitation.count({ where }),
    ]);
    return { items, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  }

  async getCitation(id: string) {
    const citation = await this.prisma.codeAuditCitation.findUnique({
      where: { id },
      include: { squad: { select: { id: true, name: true } }, citedBy: { select: { id: true, fullName: true, role: true } } },
    });
    if (!citation) throw new NotFoundException('Citation not found');
    return citation;
  }

  /** BR-CTO-05: CEO reverse penalty on the CTO (4000 -> SYSTEM_RESERVE). */
  async reversePenalty(ceoUserId: string, citationId: string, reason: string, idempotencyKey: string) {
    if (!reason || reason.length < 20) throw new BadRequestException('Reason must be at least 20 characters');
    const citation = await this.prisma.codeAuditCitation.findUnique({
      where: { id: citationId },
      include: { citedBy: true },
    });
    if (!citation) throw new NotFoundException('Citation not found');

    const amount = await this.settings.getNumber('REVERSE_AUDIT_FINE', 4000);
    const cfoRate = await this.settings.getNumber('CFO_PENALTY_INCENTIVE', 0.20);
    const cfoUser = await this.prisma.user.findFirst({ where: { role: 'CFO', isActive: true } });
    const cfoCut = cfoUser ? Math.round(amount * cfoRate * 100) / 100 : 0;
    const reserveCut = Math.round((amount - cfoCut) * 100) / 100;

    const ctoAcc = await this.ledger.personalWallet(citation.citedById);
    const reserveAcc = await this.ledger.systemReserve();

    const entries: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number }[] = [
      { accountId: ctoAcc.id, direction: 'DEBIT', amount },
    ];
    if (cfoCut > 0 && cfoUser) {
      const cfoAcc = await this.ledger.personalWallet(cfoUser.id);
      entries.push({ accountId: cfoAcc.id, direction: 'CREDIT', amount: cfoCut });
    }
    entries.push({ accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut });

    const tx = await this.ledger.postTransaction({
      entries,
      referenceType: 'FINE',
      referenceId: citation.id,
      description: `CEO reverse audit penalty: ${reason.slice(0, 120)}`,
      idempotencyKey: idempotencyKey || `reverse_${citation.id}`,
      authorizedById: ceoUserId,
      allowNegativeAccountIds: new Set([ctoAcc.id]),
    });

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: ceoUserId,
        executiveRole: 'CEO',
        actionType: 'EXECUTE_CTO_REVERSE_PENALTY',
        payloadSnapshot: { citationId, ctoId: citation.citedById, amount, transactionId: tx.id, reason } as any,
        riskSeverity: 'CRITICAL',
      },
    });

    return { citationId, penaltyAmount: amount, transactionId: tx.id, creditedTo: 'SYSTEM_RESERVE', cfoCut };
  }
}

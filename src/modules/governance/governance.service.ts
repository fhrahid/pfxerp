import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardDecisionStatus, DecisionCategory, DecisionVoteChoice, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { AuthUser, isExecRole, isBoardRole, isOverrideRole } from '../../common/types';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * 2-of-3 Multi-Signature Governance (ceo.md §3.1):
 * PROPOSED -> (2 APPROVE votes) APPROVED -> CEO sign-off -> CEO_APPROVED (executes side effects)
 * The CEO may unilaterally approve/reject at any time (BR-CEO-06).
 */
@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  private assertBoardMember(user: AuthUser) {
    if (!isBoardRole(user.role)) {
      throw new ForbiddenException('Only the executive board (CFO/CTO/CPO) may participate in decisions');
    }
  }

  async propose(user: AuthUser, dto: { title: string; description: string; category: DecisionCategory; referenceId?: string }) {
    this.assertBoardMember(user);
    const decision = await this.prisma.boardDecision.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        proposedById: user.id,
        referenceId: dto.referenceId,
        status: 'PROPOSED',
      },
    });
    this.events.emitToRoom('studio', 'governance:proposed', { decisionId: decision.id, category: decision.category });
    return decision;
  }

  async list(status?: BoardDecisionStatus) {
    return this.prisma.boardDecision.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        proposedBy: { select: { id: true, fullName: true, role: true } },
        votes: { include: { voter: { select: { id: true, fullName: true, role: true } } } },
      },
    });
  }

  async vote(user: AuthUser, decisionId: string, dto: { vote: DecisionVoteChoice; comment?: string }) {
    this.assertBoardMember(user);
    const decision = await this.prisma.boardDecision.findUnique({ where: { id: decisionId }, include: { votes: true } });
    if (!decision) throw new NotFoundException('Decision not found');

    if (decision.proposedById === user.id) {
      throw new AppException('GOVERNANCE_SELF_VOTE', 'Executives cannot vote on their own proposals (BR-CEO-03)');
    }
    if (decision.status !== 'PROPOSED') {
      throw new AppException('CONFLICT', `Decision is already ${decision.status}`);
    }
    if (decision.votes.some((v) => v.voterId === user.id)) {
      throw new AppException('GOVERNANCE_ALREADY_VOTED');
    }

    await this.prisma.decisionVote.create({
      data: { decisionId, voterId: user.id, vote: dto.vote, comment: dto.comment },
    });

    this.events.emitToRoom('studio', 'governance:vote_cast', { decisionId, voterId: user.id, vote: dto.vote });

    // Re-evaluate resolution (BR-CEO-04)
    const votes = await this.prisma.decisionVote.findMany({ where: { decisionId } });
    const approvals = votes.filter((v) => v.vote === 'APPROVE').length;
    const rejections = votes.filter((v) => v.vote === 'REJECT').length;

    if (approvals >= 2) {
      return this.prisma.boardDecision.update({
        where: { id: decisionId },
        data: { status: 'APPROVED', resolvedAt: new Date() },
      });
    }
    if (rejections >= 2) {
      return this.prisma.boardDecision.update({
        where: { id: decisionId },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
    }
    return this.prisma.boardDecision.findUnique({ where: { id: decisionId }, include: { votes: true } });
  }

  /** CEO final sign-off or veto; executes linked side effects (BR-CEO-05, BR-CEO-06). */
  async ceoDecide(user: AuthUser, decisionId: string, dto: { approve: boolean; comment?: string }) {
    const decision = await this.prisma.boardDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new NotFoundException('Decision not found');
    if (decision.status === 'CEO_APPROVED' || decision.status === 'REJECTED') {
      throw new AppException('CONFLICT', `Decision already finalized as ${decision.status}`);
    }

    const updated = await this.prisma.boardDecision.update({
      where: { id: decisionId },
      data: {
        status: dto.approve ? 'CEO_APPROVED' : 'REJECTED',
        ceoApproved: dto.approve,
        ceoComment: dto.comment,
        resolvedAt: new Date(),
      },
    });

    // Side effect: unlock the linked loan for CFO disbursement
    if (dto.approve && decision.category === DecisionCategory.LOAN_APPROVAL && decision.referenceId) {
      await this.prisma.loan.update({
        where: { id: decision.referenceId },
        data: { ceoApproved: true, approvedById: decision.proposedById },
      });
    }

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: user.id,
        executiveRole: (user.role as UserRole) || UserRole.CEO,
        actionType: dto.approve ? 'GOVERNANCE_CEO_APPROVED' : 'GOVERNANCE_CEO_VETOED',
        payloadSnapshot: { decisionId, category: decision.category, comment: dto.comment } as any,
        riskSeverity: 'INFO',
      },
    });

    this.events.emitToRoom('studio', 'governance:resolved', { decisionId, approved: dto.approve });
    return updated;
  }
}

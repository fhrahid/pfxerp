import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { AppException } from '../../common/exceptions/app.exception';
import { Prisma, UserRole } from '@prisma/client';
import { isExecRole, isOverrideRole } from '../../common/types';

/**
 * Dynamic squad topology (chro.md §2.1): elastic headcount, fractional
 * allocations, exactly one primary PM per squad, swap/fire fees.
 */
@Injectable()
export class SquadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
  ) {}

  async listSquads(user: { id: string; role: string; squadIds: string[] }, includeInactive = false) {
    const isExec = isExecRole(user.role);
    const squads = await this.prisma.squad.findMany({
      where: {
        // Deactivated squads stay visible (flagged) unless explicitly filtered.
        ...(includeInactive ? {} : { isActive: true }),
        ...(isExec ? {} : { id: { in: user.squadIds.length ? user.squadIds : ['none'] } }),
      },
      include: { account: true, _count: { select: { memberships: { where: { leftAt: null } }, tasks: true } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return squads.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      isActive: s.isActive,
      healthStatus: s.healthStatus,
      valuation: Number(s.valuation),
      balance: s.account ? Number(s.account.balance) : 0,
      memberCount: s._count.memberships,
      taskCount: s._count.tasks,
    }));
  }

  async getSquad(user: { id: string; role: string; squadIds: string[] }, squadId: string) {
    const isExec = isExecRole(user.role);
    if (!isExec && !user.squadIds.includes(squadId)) {
      throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
    }
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: {
        account: true,
        memberships: {
          where: { leftAt: null },
          include: { user: { select: { id: true, fullName: true, email: true, role: true, isActive: true } } },
        },
      },
    });
    if (!squad) throw new NotFoundException('Squad not found');
    return {
      id: squad.id,
      name: squad.name,
      description: squad.description,
      isActive: squad.isActive,
      healthStatus: squad.healthStatus,
      valuation: Number(squad.valuation),
      balance: squad.account ? Number(squad.account.balance) : 0,
      members: squad.memberships
        .filter((m) => m.user.isActive)
        .map((m) => ({
          membershipId: m.id,
          userId: m.user.id,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.role,
          allocation: Number(m.allocation),
        })),
    };
  }

  /** Create an empty treasury; funding is a separate CFO-authorized ledger transfer. */
  async createSquad(user: { id: string }, dto: { name: string; description?: string; initialBalance?: number }) {
    if (dto.initialBalance) throw new BadRequestException('New squad treasuries start empty; ask the CFO to allocate funds');
    const initial = 0;
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.squad.findUnique({ where: { name: dto.name } });
      if (existing) throw new AppException('CONFLICT', `A squad named "${dto.name}" already exists`);
      const squad = await tx.squad.create({ data: { name: dto.name, description: dto.description } });
      const treasury = await tx.account.create({
        data: { squadId: squad.id, type: 'SQUAD_TREASURY', balance: 0, currency: 'BDT' },
      });
      let accountIds: string[] = [];
      if (initial > 0) {
        const reserve = await this.ledger.systemReserve(tx);
        accountIds = [reserve.id, treasury.id];
        await this.ledger.postTransaction({
          entries: [
            { accountId: reserve.id, direction: 'DEBIT', amount: initial },
            { accountId: treasury.id, direction: 'CREDIT', amount: initial },
          ],
          referenceType: 'SQUAD_FUNDING', referenceId: squad.id,
          description: `Initial treasury funding for ${squad.name}`,
          idempotencyKey: `squad_funding_${squad.id}`, authorizedById: user.id,
        }, tx);
      }
      return { squad: { ...squad, balance: initial > 0 ? initial : 0 }, accountIds };
    }, { timeout: 15000 });
    if (created.accountIds.length) await this.ledger.publishBalanceUpdates(created.accountIds);
    return created.squad;
  }

  /** CPO/CEO: rename / re-describe / (de)activate a squad. */
  async updateSquad(squadId: string, dto: { name?: string; description?: string; isActive?: boolean }) {
    const squad = await this.prisma.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    if (dto.name && dto.name !== squad.name) {
      const clash = await this.prisma.squad.findUnique({ where: { name: dto.name } });
      if (clash) throw new AppException('CONFLICT', `A squad named "${dto.name}" already exists`);
    }

    return this.prisma.squad.update({
      where: { id: squadId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * CEO-only: permanently delete a squad and everything it owns — treasury,
   * ledger entries, tasks, memberships, payroll proposals and repos.
   * Destructive by design; the action itself is recorded in the executive audit.
   */
  async deleteSquad(caller: { id: string; role: string }, squadId: string) {
    if (caller.role !== UserRole.CEO) {
      throw new AppException('AUTHZ_FORBIDDEN', 'Only the Chief Executive Officer (CEO) has authority to delete squads.');
    }
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: { account: true, _count: { select: { tasks: true, memberships: true } } },
    });
    if (!squad) throw new NotFoundException('Squad not found');

    // A ledger entry is part of a GLOBAL HMAC chain. Deleting even one row
    // invalidates every subsequent hash and destroys financial evidence.
    if (squad.account && await this.prisma.ledgerEntry.count({ where: { accountId: squad.account.id } })) {
      throw new BadRequestException('Squad has financial history. Deactivate it instead; ledger entries must never be deleted.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. record the destructive action BEFORE removing its subject
      await tx.executiveAuditLog.create({
        data: {
          executiveId: caller.id,
          executiveRole: UserRole.CEO,
          actionType: 'SQUAD_DELETED',
          riskSeverity: 'CRITICAL',
          payloadSnapshot: {
            squadId,
            squadName: squad.name,
            balance: squad.account ? Number(squad.account.balance) : 0,
            taskCount: squad._count.tasks,
            memberCount: squad._count.memberships,
          },
        },
      });

      // Prisma cascades account, memberships, tasks (+audit),
      //    payroll proposals, sprint participants, repositories, etc.
      await tx.squad.delete({ where: { id: squadId } });
    });

    return { success: true, deleted: squadId, name: squad.name };
  }

  // ------------------------------------------------------------------
  // GitHub integration: multiple repos per squad, activity + summaries
  // ------------------------------------------------------------------
  private parseGithubUrl(url: string): { owner: string; repo: string } | null {
    const m = String(url || '').trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  private async assertSquadManager(user: { id: string; role: string }, squadId: string) {
    if (isExecRole(user.role)) return;
    const m = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId, role: 'PM', leftAt: null },
    });
    if (!m) throw new ForbiddenException('Only the squad PM or a C-level executive may manage the squad repositories');
  }

  private async assertSquadMemberOrExec(user: { id: string; role: string }, squadId: string) {
    if (isExecRole(user.role)) return;
    const m = await this.prisma.squadMembership.findFirst({
      where: { userId: user.id, squadId, leftAt: null },
    });
    if (!m) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
  }

  private async gh(path: string, token?: string | null) {
    let res: Response;
    try {
      res = await fetch(`https://api.github.com${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'pointfex-erp',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch (e) {
      throw new BadRequestException(`Could not reach GitHub (${(e as Error).name})`);
    }
    if (res.status === 403 || res.status === 429) {
      throw new BadRequestException('GitHub API rate limit reached. Connect the repository with a Personal Access Token to raise the limit.');
    }
    if (res.status === 204) {
      return [];
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160);
      throw new BadRequestException(`GitHub API ${res.status}: ${body}`);
    }
    return res.json();
  }

  async listRepos(user: { id: string; role: string }, squadId: string) {
    await this.assertSquadMemberOrExec(user, squadId);
    const repos = await this.prisma.squadRepository.findMany({
      where: { squadId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return repos.map((r) => ({ id: r.id, name: r.name, owner: r.owner, repo: r.repo, repoUrl: r.repoUrl, createdAt: r.createdAt }));
  }

  async addRepo(user: { id: string; role: string }, squadId: string, dto: { repoUrl: string; name?: string; token?: string }) {
    await this.assertSquadManager(user, squadId);
    const parsed = this.parseGithubUrl(dto.repoUrl);
    if (!parsed) throw new BadRequestException('Invalid GitHub repository URL — expected https://github.com/<owner>/<repo>');

    const dup = await this.prisma.squadRepository.findUnique({
      where: { squadId_owner_repo: { squadId, owner: parsed.owner, repo: parsed.repo } },
    });
    if (dup) throw new AppException('CONFLICT', 'This repository is already connected to the squad');

    const created = await this.prisma.squadRepository.create({
      data: {
        squadId,
        name: dto.name?.trim() || `${parsed.owner}/${parsed.repo}`,
        owner: parsed.owner,
        repo: parsed.repo,
        repoUrl: dto.repoUrl.trim(),
        token: dto.token?.trim() || null,
      },
    });

    return {
      id: created.id,
      squadId: created.squadId,
      name: created.name,
      owner: created.owner,
      repo: created.repo,
      repoUrl: created.repoUrl,
      hasToken: Boolean(created.token),
      createdAt: created.createdAt,
    };
  }

  async removeRepo(user: { id: string; role: string }, squadId: string, repoId: string) {
    await this.assertSquadManager(user, squadId);
    const repo = await this.prisma.squadRepository.findFirst({ where: { id: repoId, squadId } });
    if (!repo) throw new NotFoundException('Repository not found');
    await this.prisma.squadRepository.delete({ where: { id: repoId } });
    return { removed: true };
  }

  private async getRepoEntity(squadId: string, repoId: string) {
    const repo = await this.prisma.squadRepository.findFirst({ where: { id: repoId, squadId, isActive: true } });
    if (!repo) throw new NotFoundException('Repository not connected to this squad');
    return repo;
  }

  /** Recent commits for one connected repo. */
  async repoActivity(user: { id: string; role: string }, squadId: string, repoId: string) {
    await this.assertSquadMemberOrExec(user, squadId);
    const r = await this.getRepoEntity(squadId, repoId);
    let commits: any[];
    try {
      commits = (await this.gh(`/repos/${r.owner}/${r.repo}/commits?per_page=30`, r.token)) as any[];
    } catch {
      commits = [];
    }
    const list = Array.isArray(commits) ? commits : [];
    return {
      repoId: r.id,
      name: r.name,
      repoUrl: r.repoUrl,
      commits: list.map((c) => ({
        sha: c.sha?.slice(0, 7),
        message: String(c.commit?.message || '').split('\n')[0],
        author: c.commit?.author?.name || c.author?.login || 'unknown',
        date: c.commit?.author?.date,
        url: c.html_url,
      })),
    };
  }

  /** Repo summary: stack (languages), contributors, code size, stars, forks, issues. */
  async repoSummary(user: { id: string; role: string }, squadId: string, repoId: string) {
    await this.assertSquadMemberOrExec(user, squadId);
    const r = await this.getRepoEntity(squadId, repoId);
    const base = `/repos/${r.owner}/${r.repo}`;
    const [info, langs, contributors] = await Promise.all([
      this.gh(base, r.token).catch(() => ({})) as Promise<any>,
      this.gh(`${base}/languages`, r.token).catch(() => ({})) as Promise<Record<string, number>>,
      this.gh(`${base}/contributors?per_page=100`, r.token).catch(() => []) as Promise<any[]>,
    ]);

    const validLangs = (langs && typeof langs === 'object' && !Array.isArray(langs)) ? langs : {};
    const totalBytes = Object.values(validLangs).reduce((a, b) => a + b, 0) || 1;
    const stack = Object.entries(validLangs)
      .sort((a, b) => b[1] - a[1])
      .map(([language, bytes]) => ({
        language,
        bytes,
        share: Math.round((bytes / totalBytes) * 1000) / 10,
      }));

    return {
      repoId: r.id,
      name: r.name,
      repoUrl: r.repoUrl,
      description: info.description,
      stack,
      codeSizeBytes: totalBytes,
      stars: info.stargazers_count ?? 0,
      forks: info.forks_count ?? 0,
      openIssues: info.open_issues_count ?? 0,
      defaultBranch: info.default_branch,
      lastPushAt: info.pushed_at,
      createdAt: info.created_at,
      contributors: (Array.isArray(contributors) ? contributors : []).slice(0, 20).map((c: any) => ({
        login: c.login,
        contributions: c.contributions,
        avatarUrl: c.avatar_url,
        profileUrl: c.html_url,
      })),
      contributorCount: Array.isArray(contributors) ? contributors.length : 0,
    };
  }

  /** Sum of a user's active allocations must stay <= 1.0 (BR-CHRO-02). */
  private async assertAllocationBudget(userId: string, extraAllocation: number, tx: Prisma.TransactionClient) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`);
    const agg = await tx.squadMembership.aggregate({
      where: { userId, leftAt: null },
      _sum: { allocation: true },
    });
    const current = Number(agg._sum.allocation || 0);
    if (current + extraAllocation > 1.0 + 1e-9) {
      throw new BadRequestException(
        `Allocation budget exceeded: current ${current.toFixed(2)} + ${extraAllocation.toFixed(2)} > 1.00 (BR-CHRO-02)`,
      );
    }
  }

  /** CPO adds a member (BR-CHRO-01..04). PM role requires allocation 1.0 and squad must not already have a PM. */
  async addMember(cpoUserId: string, squadId: string, dto: { userId: string; role: 'PM' | 'DEVELOPER'; allocation: number }) {
    return this.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Squad" WHERE id = ${squadId} FOR UPDATE`);
    const squad = await tx.squad.findUnique({ where: { id: squadId } });
    if (!squad) throw new NotFoundException('Squad not found');

    const existing = await tx.squadMembership.findUnique({
      where: { userId_squadId: { userId: dto.userId, squadId } },
    });
    if (existing && !existing.leftAt) {
      throw new BadRequestException('User is already an active member of this squad');
    }

    if (dto.role === 'PM') {
      if (dto.allocation < 1.0 - 1e-9) {
        throw new BadRequestException('Squad PM must hold allocation = 1.0 (BR-CHRO-03)');
      }
      const hasPM = await tx.squadMembership.findFirst({ where: { squadId, role: 'PM', leftAt: null } });
      if (hasPM) throw new BadRequestException('Squad already has a primary PM (BR-CHRO-03)');
    }

    await this.assertAllocationBudget(dto.userId, dto.allocation, tx);

    const membership = existing
      ? await tx.squadMembership.update({ where: { id: existing.id }, data: {
          role: dto.role, allocation: dto.allocation, isPrimary: dto.role === 'PM', leftAt: null, joinedAt: new Date(),
        } })
      : await tx.squadMembership.create({ data: {
        userId: dto.userId,
        squadId,
        role: dto.role,
        allocation: dto.allocation,
        isPrimary: dto.role === 'PM',
      } });
    return membership;
    });
  }

  /** CPO removes a member; the squad pays the SWAP_FEE (BR-CHRO-20..22). */
  async removeMember(cpoUserId: string, squadId: string, userId: string, idempotencyKey: string) {
    const result = await this.prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Squad" WHERE id = ${squadId} FOR UPDATE`);
    const membership = await tx.squadMembership.findUnique({
      where: { userId_squadId: { userId, squadId } },
    });
    if (!membership || membership.leftAt) throw new NotFoundException('Active membership not found');

    const fee = await this.settings.getNumber('SWAP_FEE', 5000);
    const cutRate = await this.settings.getNumber('CPO_SWAP_CUT_RATE', 0.20);
    const cpoCut = Math.round(fee * cutRate * 100) / 100;
    const reserveCut = fee - cpoCut;

    const squadAcc = await this.ledger.squadTreasury(squadId, tx);
    const cpoAcc = await this.ledger.personalWallet(cpoUserId, tx);
    const reserveAcc = await this.ledger.systemReserve(tx);

    const accountIds = [squadAcc.id, cpoAcc.id, reserveAcc.id];
    await this.ledger.postTransaction({
      entries: [
        { accountId: squadAcc.id, direction: 'DEBIT', amount: fee },
        { accountId: cpoAcc.id, direction: 'CREDIT', amount: cpoCut },
        { accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut },
      ],
      referenceType: 'SWAP_FEE',
      referenceId: membership.id,
      description: `Squad membership termination fee for user ${userId}`,
      idempotencyKey: idempotencyKey || `swapfee_${membership.id}_${Date.now()}`,
      authorizedById: cpoUserId,
    }, tx);

    const updated = await tx.squadMembership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
    return { updated, accountIds };
    }, { timeout: 15000 });
    await this.ledger.publishBalanceUpdates(result.accountIds);
    return result.updated;
  }

  /** CPO transfers a member between squads; destination squad pays the fee. */
  async transferMember(
    cpoUserId: string,
    dto: { userId: string; fromSquadId: string; toSquadId: string; allocation?: number },
    idempotencyKey: string,
  ) {
    if (dto.fromSquadId === dto.toSquadId) throw new BadRequestException('Source and destination squads identical');
    const result = await this.prisma.$transaction(async (tx) => {
    const squadIds = [dto.fromSquadId, dto.toSquadId].sort();
    for (const id of squadIds) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Squad" WHERE id = ${id} FOR UPDATE`);
    const membership = await tx.squadMembership.findUnique({
      where: { userId_squadId: { userId: dto.userId, squadId: dto.fromSquadId } },
    });
    if (!membership || membership.leftAt) throw new NotFoundException('Active source membership not found');

    // Close old, open new
    await tx.squadMembership.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    const allocation = dto.allocation ?? Number(membership.allocation);
    if (membership.role === 'PM' && allocation < 1.0 - 1e-9) {
      throw new BadRequestException('Squad PM must hold allocation = 1.0 (BR-CHRO-03)');
    }
    // The source membership is already inactive in this transaction, so only the destination allocation remains to add.
    await this.assertAllocationBudget(dto.userId, allocation, tx);

    const prior = await tx.squadMembership.findUnique({ where: { userId_squadId: { userId: dto.userId, squadId: dto.toSquadId } } });
    if (prior && !prior.leftAt) throw new BadRequestException('User is already an active member of the destination squad');
    if (membership.role === 'PM' && await tx.squadMembership.findFirst({ where: { squadId: dto.toSquadId, role: 'PM', leftAt: null } })) {
      throw new BadRequestException('Destination squad already has a primary PM (BR-CHRO-03)');
    }
    const created = prior
      ? await tx.squadMembership.update({ where: { id: prior.id }, data: {
          role: membership.role, allocation, isPrimary: membership.isPrimary, leftAt: null, joinedAt: new Date(),
        } })
      : await tx.squadMembership.create({ data: {
        userId: dto.userId,
        squadId: dto.toSquadId,
        role: membership.role,
        allocation,
        isPrimary: membership.isPrimary,
      } });

    // Charge fee to destination squad treasury
    const fee = await this.settings.getNumber('SWAP_FEE', 5000);
    const cutRate = await this.settings.getNumber('CPO_SWAP_CUT_RATE', 0.20);
    const cpoCut = Math.round(fee * cutRate * 100) / 100;
    const reserveCut = fee - cpoCut;

      const squadAcc = await this.ledger.squadTreasury(dto.toSquadId, tx);
      const cpoAcc = await this.ledger.personalWallet(cpoUserId, tx);
      const reserveAcc = await this.ledger.systemReserve(tx);
      const accountIds = [squadAcc.id, cpoAcc.id, reserveAcc.id];
      await this.ledger.postTransaction({
        entries: [
          { accountId: squadAcc.id, direction: 'DEBIT', amount: fee },
          { accountId: cpoAcc.id, direction: 'CREDIT', amount: cpoCut },
          { accountId: reserveAcc.id, direction: 'CREDIT', amount: reserveCut },
        ],
        referenceType: 'SWAP_FEE',
        referenceId: created.id,
        description: `Squad transfer fee for user ${dto.userId}`,
        idempotencyKey: idempotencyKey || `swapfee_${created.id}_${Date.now()}`,
        authorizedById: cpoUserId,
      }, tx);
    return { created, accountIds };
    }, { timeout: 15000 });
    await this.ledger.publishBalanceUpdates(result.accountIds);
    return result.created;
  }

  async assertMembership(userId: string, squadId: string) {
    const m = await this.prisma.squadMembership.findFirst({ where: { userId, squadId, leftAt: null } });
    if (!m) throw new ForbiddenException('AUTHZ_CROSS_SQUAD');
    return m;
  }

  async assertSquadPMOrExec(userId: string, role: string, squadId: string) {
    if (isOverrideRole(role)) return;
    const m = await this.prisma.squadMembership.findFirst({ where: { userId, squadId, role: 'PM', leftAt: null } });
    if (!m) throw new ForbiddenException('Only the squad PM or an executive may perform this action');
    return m;
  }

  async pmOfSquad(squadId: string): Promise<string | null> {
    const m = await this.prisma.squadMembership.findFirst({ where: { squadId, role: 'PM', leftAt: null } });
    return m?.userId ?? null;
  }
}

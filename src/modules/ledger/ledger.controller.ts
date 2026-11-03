import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Headers, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsNumber, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { AppException } from '../../common/exceptions/app.exception';

class FreezeDto {
  @IsBoolean()
  freeze: boolean;

  @IsString()
  @MinLength(10)
  reason: string;
}

class AllocateDto {
  @IsUUID()
  squadId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

class BonusDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(10)
  reason: string;
}

class PoolFundingDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(10)
  memo: string;
}

@ApiTags('ledger')
@ApiBearerAuth()
@Controller()
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly prisma: PrismaService,
  ) {}

  /** API-CEO-03: verify the HMAC chain from genesis. */
  @Post('ledger/verify-chain')
  @Roles(UserRole.CEO)
  verifyChain() {
    return this.ledger.verifyChain();
  }

  @Get('ledger/transactions')
  @Roles(UserRole.CEO, UserRole.CFO)
  recent(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.ledger.recentTransactions(Number.isFinite(parsed) ? Math.max(1, Math.min(Math.trunc(parsed), 100)) : 25);
  }

  /** CFO moves existing reserve funds into an active squad treasury. No minting. */
  @Post('ledger/allocate')
  @Roles(UserRole.CFO)
  async allocate(@Body() dto: AllocateDto, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') key?: string) {
    if (user.role !== UserRole.CFO && user.role !== UserRole.CEO) throw new ForbiddenException();
    if (!key || !/^[\w.-]{12,96}$/.test(key)) throw new BadRequestException('A unique X-Idempotency-Key (12–96 characters) is required');
    const squad = await this.prisma.squad.findUnique({ where: { id: dto.squadId } });
    if (!squad || !squad.isActive) throw new BadRequestException('Active squad not found');
    const reserve = await this.ledger.systemReserve();
    const treasury = await this.ledger.squadTreasury(squad.id);
    const tx = await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: reserve.id,
      recipientAccountId: treasury.id,
      amount: dto.amount,
      referenceType: 'SQUAD_FUNDING',
      referenceId: squad.id,
      description: `CFO allocation to ${squad.name}`,
      idempotencyKey: `allocation_${key}`,
      authorizedById: user.id,
    });
    return { transactionId: tx.id, squadId: squad.id, amount: dto.amount };
  }

  /** Return unspent squad treasury to reserve before a controlled reallocation. */
  @Post('ledger/squads/:id/return-funds')
  @Roles(UserRole.CFO)
  async returnSquadFunds(@Param('id') squadId: string, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') key?: string) {
    if (user.role !== UserRole.CFO && user.role !== UserRole.CEO) throw new ForbiddenException();
    if (!key || !/^[\w.-]{12,96}$/.test(key)) throw new BadRequestException('A unique X-Idempotency-Key (12–96 characters) is required');
    const [reserve, treasury] = await Promise.all([this.ledger.systemReserve(), this.ledger.squadTreasury(squadId)]);
    const amount = Number(treasury.balance);
    if (amount <= 0) return { squadId, amount: 0, message: 'Treasury is already empty' };
    const tx = await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: treasury.id, recipientAccountId: reserve.id, amount,
      referenceType: 'SQUAD_FUNDING', referenceId: squadId,
      description: `Return unspent funds from squad ${squadId} to system reserve`,
      idempotencyKey: `squad_return_${key}`, authorizedById: user.id,
    });
    return { transactionId: tx.id, squadId, amount };
  }

  /** Accounting visibility: CEO/CFO all; PM own squad treasury + own wallet; others own wallet. */
  @Get('ledger/accounts')
  async accounts(@CurrentUser() user: AuthUser) {
    const all = user.role === UserRole.CEO || user.role === UserRole.CFO;
    const pmSquads = user.role === UserRole.PM ? await this.prisma.squadMembership.findMany({
      where: { userId: user.id, role: 'PM', leftAt: null }, select: { squadId: true },
    }) : [];
    return this.prisma.account.findMany({
      where: all ? {} : { OR: [{ ownerId: user.id }, { squadId: { in: pmSquads.map((m) => m.squadId) } }] },
      select: { id: true, type: true, ownerId: true, squadId: true, balance: true, currency: true, isFrozen: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('ledger/accounts/:id/entries')
  async accountEntries(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const allowed = await this.accounts(user);
    if (!allowed.some((a) => a.id === id)) throw new ForbiddenException('This account is outside your accounting scope');
    return this.prisma.ledgerEntry.findMany({
      where: { accountId: id }, orderBy: { sequenceNumber: 'desc' }, take: 100,
      select: { id: true, direction: true, amount: true, createdAt: true, sequenceNumber: true,
        transaction: { select: { id: true, referenceType: true, description: true, createdAt: true } } },
    });
  }

  @Get('ledger/pool-funding/requests')
  @Roles(UserRole.CEO, UserRole.CFO)
  listPoolFundingRequests() {
    return this.prisma.poolFundingRequest.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      include: { requestedBy: { select: { id: true, fullName: true, email: true } }, approvedBy: { select: { id: true, fullName: true } } },
    });
  }

  @Post('ledger/pool-funding/requests')
  @Roles(UserRole.CFO)
  requestPoolFunding(@Body() dto: PoolFundingDto, @CurrentUser() user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.poolFundingRequest.create({ data: { requestedById: user.id, amount: dto.amount, memo: dto.memo.trim() } });
      await tx.executiveAuditLog.create({
        data: { executiveId: user.id, executiveRole: UserRole.CFO, actionType: 'POOL_FUNDING_REQUESTED', riskSeverity: 'WARNING', payloadSnapshot: { requestId: request.id, amount: dto.amount, memo: dto.memo.trim() } },
      });
      return request;
    });
  }

  @Post('ledger/pool-funding/requests/:id/approve')
  @Roles(UserRole.CEO)
  async approvePoolFunding(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const req = await this.prisma.poolFundingRequest.findUnique({ where: { id } });
    if (!req) throw new BadRequestException('Funding request not found');
    if (req.requestedById === user.id) throw new ForbiddenException('Maker-checker: requester cannot approve their own funding request');
    return this.applyPoolFunding(Number(req.amount), req.memo, user, id);
  }

  @Post('ledger/pool-funding/direct')
  @Roles(UserRole.CEO)
  directPoolFunding(@Body() dto: PoolFundingDto, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') key?: string) {
    if (!key || !/^[\w.-]{12,96}$/.test(key)) throw new BadRequestException('A unique X-Idempotency-Key (12–96 characters) is required');
    return this.applyPoolFunding(dto.amount, dto.memo.trim(), user, `ceo_${key}`);
  }

  private async applyPoolFunding(amount: number, memo: string, user: AuthUser, reference: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      if (!reference.startsWith('ceo_')) {
        const claim = await tx.poolFundingRequest.updateMany({ where: { id: reference, status: 'PENDING' }, data: { status: 'PROCESSING' } });
        if (!claim.count) throw new BadRequestException('Funding request is already processed or unavailable');
      }
      let capital = await tx.account.findFirst({ where: { type: 'CAPITAL_SOURCE' } });
      if (!capital) capital = await tx.account.create({ data: { type: 'CAPITAL_SOURCE', balance: 0, currency: 'BDT' } });
      const reserve = await tx.account.findFirst({ where: { type: 'SYSTEM_RESERVE' } });
      if (!reserve) throw new BadRequestException('System reserve is not provisioned');
      const ledgerTx = await this.ledger.postTransaction({
        entries: [
          { accountId: capital.id, direction: 'DEBIT', amount },
          { accountId: reserve.id, direction: 'CREDIT', amount },
        ],
        referenceType: 'CAPITAL_INJECTION', referenceId: reference,
        description: `External capital added to pool: ${memo}`,
        idempotencyKey: `capital_injection_${reference}`, authorizedById: user.id,
        allowNegativeAccountIds: new Set([capital.id]),
      }, tx);
      if (!reference.startsWith('ceo_')) {
        await tx.poolFundingRequest.update({ where: { id: reference }, data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() } });
      }
      await tx.executiveAuditLog.create({
        data: { executiveId: user.id, executiveRole: UserRole.CEO, actionType: reference.startsWith('ceo_') ? 'POOL_CAPITAL_ADDED' : 'POOL_FUNDING_APPROVED', riskSeverity: 'CRITICAL', payloadSnapshot: { amount, memo, requestId: reference, transactionId: ledgerTx.id } },
      });
      return { transactionId: ledgerTx.id, amount, accountIds: [capital.id, reserve.id] };
    });
    await this.ledger.publishBalanceUpdates(result.accountIds);
    return result;
  }

  /** API-CEO-04: freeze/unfreeze any account (BR-CEO-12). */
  @Post('accounts/:id/freeze')
  @Roles(UserRole.CEO)
  async freeze(@Param('id') accountId: string, @Body() dto: FreezeDto, @CurrentUser() user: AuthUser) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new AppException('NOT_FOUND', 'Account not found');

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { isFrozen: dto.freeze },
    });

    await this.prisma.executiveAuditLog.create({
      data: {
        executiveId: user.id,
        executiveRole: (user.role as UserRole) || UserRole.CEO,
        actionType: dto.freeze ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
        payloadSnapshot: { accountId, reason: dto.reason },
        riskSeverity: 'WARNING',
      },
    });

    return { accountId: updated.id, isFrozen: updated.isFrozen, updatedAt: updated.updatedAt };
  }

  /** CEO discretionary bonus straight from SYSTEM_RESERVE (BR-CEO-14). */
  @Post('accounts/:id/bonus')
  @Roles(UserRole.CEO)
  async bonus(
    @Param('id') accountId: string,
    @Body() body: BonusDto,
    @CurrentUser() user: AuthUser,
    @Query('idempotencyKey') idem?: string,
  ) {
    const reserve = await this.ledger.systemReserve();
    const recipient = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!recipient || recipient.type !== 'PERSONAL_WALLET' || !recipient.ownerId) {
      throw new BadRequestException('Bonuses may only credit a personal wallet');
    }
    const tx = await this.ledger.executeDoubleEntryTransfer({
      senderAccountId: reserve.id,
      recipientAccountId: accountId,
      amount: body.amount,
      referenceType: 'CEO_BONUS',
      description: body.reason,
      idempotencyKey: idem || `bonus_${accountId}_${Date.now()}`,
      authorizedById: user.id,
    });
    return { transactionId: tx.id, amount: body.amount };
  }
}

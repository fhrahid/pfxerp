import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsBoolean, IsString, MinLength } from 'class-validator';
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
    return this.ledger.recentTransactions(Math.min(Number(limit) || 25, 100));
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
    @Body() body: { amount: number; reason: string },
    @CurrentUser() user: AuthUser,
    @Query('idempotencyKey') idem?: string,
  ) {
    const reserve = await this.ledger.systemReserve();
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

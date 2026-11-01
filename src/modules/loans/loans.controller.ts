import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsUUID, Min } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { LoansService } from './loans.service';

class ApplyLoanDto {
  @IsUUID()
  squadId: string;

  @Min(1)
  principalAmount: number;
}

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  @Roles(UserRole.PM)
  apply(@Body() dto: ApplyLoanDto, @CurrentUser() user: AuthUser) {
    return this.loans.apply(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.loans.list(user);
  }

  /** API-CFO-02. */
  @Post(':id/approve')
  @Roles(UserRole.CFO)
  disburse(@Param('id') id: string, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.loans.disburse(user.id, id, idem || '');
  }

  @Post(':id/repay')
  @Roles(UserRole.PM)
  repay(@Param('id') id: string, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.loans.repay(user, id, idem || '');
  }
}

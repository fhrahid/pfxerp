import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollTier, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PayrollService } from './payroll.service';

class LineItemDto {
  @IsUUID()
  userId: string;

  @IsEnum(PayrollTier)
  tier: PayrollTier;

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  justification?: string;
}

class SubmitPayrollDto {
  @IsUUID()
  squadId: string;

  @IsInt()
  @Min(1)
  labNumber: number;

  @IsOptional()
  @IsInt()
  sprintNumber?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];
}

class SlackerFineDto {
  @IsUUID()
  targetUserId: string;

  @IsUUID()
  targetSquadId: string;

  @IsString()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

@ApiTags('payroll')
@ApiBearerAuth()
@Controller()
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  /** API-CHRO-01. */
  @Post('payroll')
  @Roles(UserRole.PM)
  submit(@Body() dto: SubmitPayrollDto, @CurrentUser() user: AuthUser) {
    return this.payroll.submitProposal(user, dto);
  }

  @Get('payroll')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.payroll.listProposals(user, status);
  }

  /** API-CHRO-02. */
  @Post('payroll/:id/approve')
  @Roles(UserRole.CPO, UserRole.CEO)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payroll.approveAndDisburse(user, id);
  }

  @Post('payroll/:id/reject')
  @Roles(UserRole.CPO)
  reject(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AuthUser) {
    return this.payroll.reject(user.id, id, body.reason);
  }

  /** API-CHRO-04. */
  @Post('fines/slacker')
  @Roles(UserRole.CPO)
  slacker(@Body() dto: SlackerFineDto, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.payroll.issueSlackerFine(user.id, dto, idem || '');
  }
}

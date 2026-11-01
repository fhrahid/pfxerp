import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { SprintPayoutsService } from './sprint-payouts.service';

class RankingDto {
  @IsUUID()
  squadId: string;

  @IsInt()
  @Min(1)
  rank: number;
}

class SubmitPayoutDto {
  @IsInt()
  @Min(1)
  sprintNumber: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RankingDto)
  rankings: RankingDto[];
}

@ApiTags('sprint-payouts')
@ApiBearerAuth()
@Controller('sprint-payouts')
export class SprintPayoutsController {
  constructor(private readonly payouts: SprintPayoutsService) {}

  /** API-CFO-01. */
  @Post()
  @Roles(UserRole.CFO)
  submit(@Body() dto: SubmitPayoutDto, @CurrentUser() user: AuthUser) {
    return this.payouts.submit(user.id, dto);
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO, UserRole.PM)
  list() {
    return this.payouts.list();
  }

  @Post(':id/ceo-approve')
  @Roles(UserRole.CEO)
  ceoApprove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.payouts.approveByCeo(user.id, id);
  }

  @Post(':id/execute')
  @Roles(UserRole.CFO)
  execute(@Param('id') id: string, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.payouts.execute(user.id, id, idem || '');
  }
}

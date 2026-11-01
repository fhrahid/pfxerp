import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { BugSeverity, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BountyService } from './bounty.service';

class CreateTargetDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  targetSquadId: string;

  @IsInt()
  @Min(5000)
  totalBountyPool: number;

  @IsOptional()
  @IsUUID()
  clientMilestoneId?: string;
}

class SubmitReportDto {
  @IsOptional()
  @IsUUID()
  bountyTargetId?: string;

  @IsUUID()
  targetSquadId: string;

  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsString()
  @MinLength(30)
  reproductionSteps: string;

  @IsOptional()
  @IsString()
  proofOfConceptUrl?: string;

  @IsEnum(BugSeverity)
  severity: BugSeverity;
}

class TriageDto {
  @IsEnum({ VERIFY: 'VERIFY', REJECT: 'REJECT' } as const)
  action: 'VERIFY' | 'REJECT';

  @IsOptional()
  @IsEnum(BugSeverity)
  severity?: BugSeverity;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('bounty')
@ApiBearerAuth()
@Controller('bounty')
export class BountyController {
  constructor(private readonly bounty: BountyService) {}

  /** API-CTO-11. */
  @Post('targets')
  @Roles(UserRole.CTO, UserRole.PM, UserRole.CEO)
  createTarget(@Body() dto: CreateTargetDto, @CurrentUser() user: AuthUser) {
    return this.bounty.createTarget(user, dto);
  }

  /** API-CTO-12. */
  @Get('targets')
  listTargets(@Query('isActive') isActive = 'true') {
    return this.bounty.listTargets(isActive !== 'false');
  }

  /** API-DEV-03 / API-CTO-13. */
  @Post('reports')
  @Roles(UserRole.DEVELOPER, UserRole.CTO)
  submitReport(@Body() dto: SubmitReportDto, @CurrentUser() user: AuthUser) {
    return this.bounty.submitReport(user, dto);
  }

  /** API-CTO-14. */
  @Get('reports')
  listReports(
    @Query('targetSquadId') targetSquadId?: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.bounty.listReports({ targetSquadId, status, severity });
  }

  /** API-CTO-15. */
  @Post('reports/:id/triage')
  @Roles(UserRole.CTO)
  triage(@Param('id') id: string, @Body() dto: TriageDto, @CurrentUser() user: AuthUser) {
    return this.bounty.triage(user.id, id, dto);
  }
}

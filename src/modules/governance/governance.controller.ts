import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { BoardDecisionStatus, DecisionCategory, DecisionVoteChoice, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { GovernanceService } from './governance.service';

class ProposeDto {
  @IsString()
  @MinLength(5)
  title: string;

  @IsString()
  @MinLength(15)
  description: string;

  @IsEnum(DecisionCategory)
  category: DecisionCategory;

  @IsOptional()
  @IsUUID()
  referenceId?: string;
}

class VoteDto {
  @IsEnum(DecisionVoteChoice)
  vote: DecisionVoteChoice;

  @IsOptional()
  @IsString()
  comment?: string;
}

class CeoDecideDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('governance')
@ApiBearerAuth()
@Controller('governance/decisions')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Post()
  @Roles(UserRole.CFO, UserRole.CTO, UserRole.CPO)
  propose(@Body() dto: ProposeDto, @CurrentUser() user: AuthUser) {
    return this.governance.propose(user, dto);
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  list(@Query('status') status?: BoardDecisionStatus) {
    return this.governance.list(status);
  }

  @Post(':id/vote')
  @Roles(UserRole.CFO, UserRole.CTO, UserRole.CPO)
  vote(@Param('id') id: string, @Body() dto: VoteDto, @CurrentUser() user: AuthUser) {
    return this.governance.vote(user, id, dto);
  }

  @Post(':id/ceo-decide')
  @Roles(UserRole.CEO)
  ceoDecide(@Param('id') id: string, @Body() dto: CeoDecideDto, @CurrentUser() user: AuthUser) {
    return this.governance.ceoDecide(user, id, dto);
  }
}

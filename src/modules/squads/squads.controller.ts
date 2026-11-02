import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsNumber, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { SquadsService } from './squads.service';

class GithubRepoDto {
  @IsString()
  @MinLength(11)
  repoUrl: string;

  @IsOptional()
  @IsString()
  token?: string;
}

class AddMemberDto {
  @IsUUID()
  userId: string;

  @IsIn(['PM', 'DEVELOPER'])
  role: 'PM' | 'DEVELOPER';

  @IsNumber()
  @Min(0.01)
  @Max(1)
  allocation: number;
}

class CreateSquadDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalance?: number;
}

class UpdateSquadDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  isActive?: boolean;
}

class TransferMemberDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  fromSquadId: string;

  @IsUUID()
  toSquadId: string;

  @IsNumber()
  @Min(0.01)
  @Max(1)
  allocation: number;
}

@ApiTags('squads')
@ApiBearerAuth()
@Controller('squads')
export class SquadsController {
  constructor(private readonly squads: SquadsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.squads.listSquads(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squads.getSquad(user, id);
  }

  /** CPO/CEO: create a squad (treasury auto-provisioned, funded from reserve). */
  @Post()
  @Roles(UserRole.CPO, UserRole.CEO)
  create(@Body() dto: CreateSquadDto, @CurrentUser() user: AuthUser) {
    return this.squads.createSquad(user, dto);
  }

  /** CPO/CEO: rename / re-describe / (de)activate. */
  @Patch(':id')
  @Roles(UserRole.CPO, UserRole.CEO)
  update(@Param('id') id: string, @Body() dto: UpdateSquadDto) {
    return this.squads.updateSquad(id, dto);
  }

  /** Connect the squad's GitHub repo (squad PM or C-level). */
  @Put(':id/github')
  @Roles(UserRole.PM, UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  connectGithub(@Param('id') id: string, @Body() dto: GithubRepoDto, @CurrentUser() user: AuthUser) {
    return this.squads.setGithubRepo(user, id, dto);
  }

  /** Recent commits for the squad's repo (squad members + C-level). */
  @Get(':id/github/activity')
  githubActivity(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.squads.githubActivity(user, id);
  }

  /** CPO roster management (chro.md §2.5). */
  @Post(':id/members')
  @Roles(UserRole.CPO, UserRole.CEO)
  addMember(@Param('id') squadId: string, @Body() dto: AddMemberDto, @CurrentUser() user: AuthUser) {
    return this.squads.addMember(user.id, squadId, dto);
  }

  @Post('members/transfer')
  @Roles(UserRole.CPO, UserRole.CEO)
  transferMember(
    @Body() dto: TransferMemberDto,
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.squads.transferMember(user.id, dto, idem || '');
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.CPO, UserRole.CEO)
  removeMember(
    @Param('id') squadId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.squads.removeMember(user.id, squadId, userId, idem || '');
  }
}

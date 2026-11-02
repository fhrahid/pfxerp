import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { TasksService } from './tasks.service';

class CreateTaskDto {
  @IsUUID()
  squadId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  storyPoints?: number;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsInt()
  sprintNumber?: number;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  clientMilestoneId?: string;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(13)
  storyPoints?: number;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

class FlagCompleteDto {
  @IsOptional()
  @IsString()
  gitPrUrl?: string;

  @IsOptional()
  @IsString()
  gitCommitHash?: string;
}

class PmRejectDto {
  @IsBoolean()
  isPremature: boolean;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(50)
  penaltyPoints?: number;

  @IsString()
  @MinLength(10)
  feedback: string;
}

class CtoRejectDto {
  @IsString()
  @MinLength(20)
  critique: string;

  @IsEnum({ CODE_SMELL: 'CODE_SMELL', BAD_MERGE_REQUEST: 'BAD_MERGE_REQUEST', SECURITY_VULNERABILITY: 'SECURITY_VULNERABILITY' } as const)
  citationType: 'CODE_SMELL' | 'BAD_MERGE_REQUEST' | 'SECURITY_VULNERABILITY';
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @Roles(UserRole.PM, UserRole.CTO, UserRole.CPO, UserRole.CEO)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.createTask(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('squadId') squadId?: string,
    @Query('status') status?: TaskStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('sprintNumber') sprintNumber?: string,
  ) {
    return this.tasks.listTasks(user, {
      squadId,
      status,
      assignedToId,
      sprintNumber: sprintNumber ? Number(sprintNumber) : undefined,
    });
  }

  @Get('pending-verification')
  @Roles(UserRole.CTO, UserRole.CEO)
  pending(@Query('squadId') squadId?: string) {
    return this.tasks.pendingVerification(squadId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.getTask(user, id);
  }

  @Patch(':id')
  @Roles(UserRole.PM, UserRole.CTO, UserRole.CPO, UserRole.CEO)
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.updateTask(user, id, dto);
  }

  @Post(':id/start')
  @Roles(UserRole.DEVELOPER, UserRole.PM)
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.startTask(user, id);
  }

  @Post(':id/flag-complete')
  @Roles(UserRole.DEVELOPER)
  flagComplete(@Param('id') id: string, @Body() dto: FlagCompleteDto, @CurrentUser() user: AuthUser) {
    return this.tasks.flagComplete(user, id, dto);
  }

  @Post(':id/pm-verify')
  @Roles(UserRole.PM, UserRole.CTO, UserRole.CPO)
  pmVerify(@Param('id') id: string, @Body() body: { comment?: string }, @CurrentUser() user: AuthUser) {
    return this.tasks.pmVerify(user, id, body.comment);
  }

  @Post(':id/pm-reject')
  @Roles(UserRole.PM, UserRole.CTO, UserRole.CPO)
  pmReject(@Param('id') id: string, @Body() dto: PmRejectDto, @CurrentUser() user: AuthUser) {
    return this.tasks.pmReject(user, id, dto);
  }

  @Post(':id/cto-verify')
  @Roles(UserRole.CTO)
  ctoVerify(@Param('id') id: string, @Body() body: { critique?: string }, @CurrentUser() user: AuthUser) {
    return this.tasks.ctoVerify(user, id, body);
  }

  @Post(':id/cto-reject')
  @Roles(UserRole.CTO)
  ctoReject(@Param('id') id: string, @Body() dto: CtoRejectDto, @CurrentUser() user: AuthUser) {
    return this.tasks.ctoReject(user, id, dto);
  }

  @Post(':id/close')
  @Roles(UserRole.PM, UserRole.CTO)
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.closeTask(user, id);
  }
}

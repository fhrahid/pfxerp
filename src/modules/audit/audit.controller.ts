import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CodeAuditCitationType, UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { AuditService } from './audit.service';

class CreateCitationDto {
  @IsUUID()
  squadId: string;

  @IsEnum(CodeAuditCitationType)
  type: CodeAuditCitationType;

  @IsString()
  @MinLength(15)
  description: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  commitHash?: string;
}

@ApiTags('cto-audit')
@ApiBearerAuth()
@Controller('cto/citations')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** API-CTO-01. */
  @Post()
  @Roles(UserRole.CTO)
  issue(@Body() dto: CreateCitationDto, @CurrentUser() user: AuthUser, @Headers('x-idempotency-key') idem?: string) {
    return this.audit.issueCitation(user.id, dto, idem || '');
  }

  /** API-CTO-02. */
  @Get()
  list(
    @Query('squadId') squadId?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.audit.listCitations({
      squadId,
      type,
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    });
  }

  /** API-CTO-03. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.audit.getCitation(id);
  }

  /** API-CTO-27. */
  @Post(':id/reverse-penalty')
  @Roles(UserRole.CEO)
  reverse(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthUser,
    @Headers('x-idempotency-key') idem?: string,
  ) {
    return this.audit.reversePenalty(user.id, id, body.reason, idem || '');
  }
}

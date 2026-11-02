import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class ExecutiveAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CTO, UserRole.CPO)
  listLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('role') role?: string,
    @Query('actionType') actionType?: string,
    @Query('severity') severity?: string,
  ) {
    return this.audit.listExecutiveAuditLogs({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 50, 100),
      role,
      actionType,
      severity,
    });
  }
}

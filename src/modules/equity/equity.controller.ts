import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { EquityService } from './equity.service';

class InvestDto {
  @IsUUID()
  squadId: string;

  @Min(1)
  investedAmount: number;

  @IsOptional()
  @IsInt()
  sprintNumber?: number;
}

@ApiTags('equity')
@ApiBearerAuth()
@Controller('equity')
export class EquityController {
  constructor(private readonly equity: EquityService) {}

  /** API-CFO-03. */
  @Post()
  @Roles(UserRole.CFO)
  invest(@Body() dto: InvestDto, @CurrentUser() user: AuthUser) {
    return this.equity.invest(user.id, dto);
  }

  @Get()
  @Roles(UserRole.CFO, UserRole.CEO)
  portfolio(@CurrentUser() user: AuthUser) {
    return this.equity.portfolio(user.id);
  }
}

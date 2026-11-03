import { Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** API-CEO-01. */
  @Get('dashboard/ceo')
  @Roles(UserRole.CEO)
  ceo() {
    return this.dashboard.ceoDashboard();
  }

  @Get('dashboard/cto')
  @Roles(UserRole.CTO, UserRole.CEO)
  cto() {
    return this.dashboard.ctoDashboard();
  }

  /** API-CTO-25: squad tech scores leaderboard. */
  @Get('cto/squad-tech-scores')
  squadTechScores() {
    return this.dashboard.squadTechScores();
  }

  @Get('dashboard/cfo')
  @Roles(UserRole.CFO, UserRole.CEO)
  cfo() {
    return this.dashboard.cfoDashboard();
  }

  @Post('dashboard/cfo/recalculate-valuations')
  @Roles(UserRole.CFO, UserRole.CEO)
  recalculateValuations(@CurrentUser() user: AuthUser) {
    return this.dashboard.recalculateSquadValuations(user);
  }

  @Get('dashboard/me')
  me(@CurrentUser() user: AuthUser) {
    return this.dashboard.meDashboard(user);
  }

  /** API-OTH-02: studio simulation leaderboard. */
  @Get('simulation-scores')
  leaderboard() {
    return this.dashboard.leaderboard();
  }
}

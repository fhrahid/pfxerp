import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { SettingsModule } from './modules/settings/settings.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SquadsModule } from './modules/squads/squads.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { NoticesModule } from './modules/notices/notices.module';
import { LoansModule } from './modules/loans/loans.module';
import { EquityModule } from './modules/equity/equity.module';
import { SprintPayoutsModule } from './modules/sprint-payouts/sprint-payouts.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { ChaosModule } from './modules/chaos/chaos.module';
import { BountyModule } from './modules/bounty/bounty.module';
import { AuditModule } from './modules/audit/audit.module';
import { CertificationsModule } from './modules/certifications/certifications.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { ConsultancyModule } from './modules/consultancy/consultancy.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Global infrastructure
    PrismaModule,
    EventsModule,
    SettingsModule,
    // Business modules
    AuthModule,
    UsersModule,
    SquadsModule,
    LedgerModule,
    TasksModule,
    PayrollModule,
    NoticesModule,
    LoansModule,
    EquityModule,
    SprintPayoutsModule,
    GovernanceModule,
    ChaosModule,
    BountyModule,
    AuditModule,
    CertificationsModule,
    MarketplaceModule,
    ConsultancyModule,
    ClientsModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}

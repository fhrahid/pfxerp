import { Module } from '@nestjs/common';
import { ConsultancyController } from './consultancy.controller';
import { ConsultancyService } from './consultancy.service';
import { LedgerModule } from '../ledger/ledger.module';
import { CertificationsModule } from '../certifications/certifications.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [LedgerModule, CertificationsModule, DashboardModule],
  controllers: [ConsultancyController],
  providers: [ConsultancyService],
})
export class ConsultancyModule {}

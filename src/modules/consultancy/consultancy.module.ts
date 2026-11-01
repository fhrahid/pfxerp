import { Module } from '@nestjs/common';
import { ConsultancyController } from './consultancy.controller';
import { ConsultancyService } from './consultancy.service';
import { LedgerModule } from '../ledger/ledger.module';
import { CertificationsModule } from '../certifications/certifications.module';

@Module({
  imports: [LedgerModule, CertificationsModule],
  controllers: [ConsultancyController],
  providers: [ConsultancyService],
})
export class ConsultancyModule {}

import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { LedgerModule } from '../ledger/ledger.module';
import { CertificationsModule } from '../certifications/certifications.module';

@Module({
  imports: [LedgerModule, CertificationsModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}

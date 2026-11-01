import { Module } from '@nestjs/common';
import { EquityController } from './equity.controller';
import { EquityService } from './equity.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [EquityController],
  providers: [EquityService],
  exports: [EquityService],
})
export class EquityModule {}

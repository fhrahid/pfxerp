import { Module } from '@nestjs/common';
import { SprintPayoutsController } from './sprint-payouts.controller';
import { SprintPayoutsService } from './sprint-payouts.service';
import { LedgerModule } from '../ledger/ledger.module';
import { EquityModule } from '../equity/equity.module';

@Module({
  imports: [LedgerModule, EquityModule],
  controllers: [SprintPayoutsController],
  providers: [SprintPayoutsService],
})
export class SprintPayoutsModule {}

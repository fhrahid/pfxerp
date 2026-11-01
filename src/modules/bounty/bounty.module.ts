import { Module } from '@nestjs/common';
import { BountyController } from './bounty.controller';
import { BountyService } from './bounty.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  controllers: [BountyController],
  providers: [BountyService],
})
export class BountyModule {}

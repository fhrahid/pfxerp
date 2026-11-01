import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { LedgerModule } from '../ledger/ledger.module';
import { EquityModule } from '../equity/equity.module';

@Module({
  imports: [LedgerModule, EquityModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}

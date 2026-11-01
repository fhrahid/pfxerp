import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ChaosModule } from '../chaos/chaos.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ChaosModule, AuditModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

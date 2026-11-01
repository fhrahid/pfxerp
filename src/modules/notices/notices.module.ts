import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

@Module({
  controllers: [NoticesController],
  providers: [PrismaService, EventsGateway],
})
export class NoticesModule {}

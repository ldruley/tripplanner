import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullMQModule } from '@trip-planner/bullmq';
import { RedisModule } from '@trip-planner/redis';
import { EmailService } from './email.service';
import { EmailWorker } from './email.worker';

@Module({
  imports: [
    HttpModule,
    BullMQModule,
    RedisModule,
  ],
  controllers: [],
  providers: [EmailService, EmailWorker],
  exports: [EmailService],
})
export class EmailModule {}

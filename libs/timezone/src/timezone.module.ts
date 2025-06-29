import { Module } from '@nestjs/common';
import { BullMQModule } from '@trip-planner/bullmq';
import { RedisModule } from '@trip-planner/redis';
import { TimezoneService } from './timezone.service';
import { TimezoneWorker } from './timezone.worker';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TimezoneController } from './timezone.controller';

@Module({
  controllers: [TimezoneController],
  imports: [BullMQModule, RedisModule, HttpModule, ConfigModule],
  providers: [TimezoneService, TimezoneWorker],
  exports: [TimezoneService],
})
export class TimezoneModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { TravelSegmentController } from './travel-segment.controller';
import { TravelSegmentService } from './travel-segment.service';
import { TravelSegmentRepository } from './travel-segment.repository';

@Module({
  imports: [PrismaModule],
  controllers: [TravelSegmentController],
  providers: [TravelSegmentService, TravelSegmentRepository],
  exports: [TravelSegmentService, TravelSegmentRepository],
})
export class TravelSegmentModule {}

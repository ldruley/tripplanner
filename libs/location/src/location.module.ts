import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';
import { LocationController } from './location.controller';
import { TimezoneModule } from '@trip-planner/timezone';
import { LocationProcessorService } from './location-processor.service';

@Module({
  imports: [PrismaModule, TimezoneModule],
  controllers: [LocationController],
  providers: [LocationService, LocationRepository, LocationProcessorService],
  exports: [LocationService, LocationRepository, LocationProcessorService],
})
export class LocationModule {}

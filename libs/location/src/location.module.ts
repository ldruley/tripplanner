import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';
import { LocationController } from './location.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}

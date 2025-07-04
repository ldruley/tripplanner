import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}

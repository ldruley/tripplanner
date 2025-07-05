import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { TripController } from './trip.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TripController],
  providers: [TripService, TripRepository],
  exports: [TripService, TripRepository],
})
export class TripModule {}

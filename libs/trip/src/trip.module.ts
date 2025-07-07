import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { MatrixRoutingModule } from '@trip-planner/matrix-routing';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { TripController } from './trip.controller';

@Module({
  imports: [PrismaModule, MatrixRoutingModule],
  controllers: [TripController],
  providers: [TripService, TripRepository],
  exports: [TripService, TripRepository],
})
export class TripModule {}

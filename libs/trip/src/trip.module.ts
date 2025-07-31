import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { MatrixRoutingModule } from '@trip-planner/matrix-routing';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { TripController } from './trip.controller';
import { TripParticipantService } from './trip-participant.service';
import { TripParticipantRepository } from './trip-participant.repository';

@Module({
  imports: [PrismaModule, MatrixRoutingModule],
  controllers: [TripController],
  providers: [
    TripService,
    TripRepository,
    TripParticipantService,
    TripParticipantRepository,
  ],
  exports: [
    TripService,
    TripRepository,
    TripParticipantService,
    TripParticipantRepository,
  ],
})
export class TripModule {}

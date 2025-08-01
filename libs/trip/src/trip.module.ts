import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { MatrixRoutingModule } from '@trip-planner/matrix-routing';
import { TripService } from './trip.service';
import { TripRepository } from './trip.repository';
import { TripController } from './trip.controller';
import { TripParticipantService } from './trip-participant.service';
import { TripParticipantRepository } from './trip-participant.repository';
import { TripPermissionService } from './trip-permission.service';

@Module({
  imports: [PrismaModule, MatrixRoutingModule],
  controllers: [TripController],
  providers: [
    TripService,
    TripRepository,
    TripParticipantService,
    TripParticipantRepository,
    TripPermissionService,
  ],
  exports: [
    TripService,
    TripRepository,
    TripParticipantService,
    TripParticipantRepository,
    TripPermissionService,
  ],
})
export class TripModule {}

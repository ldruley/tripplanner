import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { TripModule } from '@trip-planner/trip';
import { LocationModule } from '@trip-planner/location';
import { StopModule } from '@trip-planner/stop';
import { TravelSegmentModule } from '@trip-planner/travel-segment';
import { TimelineModule } from '@trip-planner/timeline';
import { RoutingModule } from '@trip-planner/routing';
import { ItineraryController } from './itinerary.controller';
import { ItineraryService } from './itinerary.service';
import { TripCreationService } from './trip-creation.service';
import { BatchedTripCreationService } from './batched-trip-creation.service';
import { StopCoordinationService } from './stop-coordination.service';
import { RoutingCoordinationService } from './routing-coordination.service';
import { TripBankedLocationService } from './trip-banked-location.service';
import { TimelineCoordinationService } from './timeline-coordination.service';
import { TripBankedLocationRepository } from './trip-banked-location.repository';
import { UnifiedBatchingService } from './unified-batching.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';

@Module({
  imports: [
    PrismaModule,
    TripModule,
    LocationModule,
    StopModule,
    TravelSegmentModule,
    TimelineModule,
    RoutingModule,
  ],
  controllers: [ItineraryController],
  providers: [
    ItineraryService,
    TripCreationService,
    BatchedTripCreationService,
    StopCoordinationService,
    RoutingCoordinationService,
    TripBankedLocationService,
    TimelineCoordinationService,
    TripBankedLocationRepository,
    UnifiedBatchingService,
    SharedValidationService,
    SharedLocationProcessingService,
  ],
  exports: [
    ItineraryService,
    TripCreationService,
    BatchedTripCreationService,
    StopCoordinationService,
    RoutingCoordinationService,
    TripBankedLocationService,
    TimelineCoordinationService,
    TripBankedLocationRepository,
    UnifiedBatchingService,
    SharedValidationService,
    SharedLocationProcessingService,
  ],
})
export class ItineraryModule {}

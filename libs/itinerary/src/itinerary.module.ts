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
import { StopCoordinationService } from './stop-coordination.service';
import { TripBankedLocationService } from './tripbankedlocation/trip-banked-location.service';
import { TimelineCoordinationService } from './timeline-coordination.service';
import { TripBankedLocationRepository } from './tripbankedlocation/trip-banked-location.repository';
import { UnifiedBatchingService } from './unified-batching.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';
import { SegmentPlanningService } from './segment-planning.service';
import { SegmentCalculationService } from './segment-calculation.service';
import { RoutingIntegrationService } from './routing-integration.service';
import { RoutingTransformationService } from './routing-transformation.service';
import { OrderManagementService } from './order-management.service';
import { SharedTransactionService } from './shared-transaction.service';

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
    StopCoordinationService,
    TripBankedLocationService,
    TimelineCoordinationService,
    TripBankedLocationRepository,
    UnifiedBatchingService,
    SharedValidationService,
    SharedLocationProcessingService,
    // Advanced orchestration services
    SegmentPlanningService,
    SegmentCalculationService,
    RoutingIntegrationService,
    RoutingTransformationService,
    OrderManagementService,
    SharedTransactionService,
  ],
  exports: [
    ItineraryService,
    StopCoordinationService,
    TripBankedLocationService,
    TimelineCoordinationService,
    TripBankedLocationRepository,
    UnifiedBatchingService,
    SharedValidationService,
    SharedLocationProcessingService,
  ],
})
export class ItineraryModule {}

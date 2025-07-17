import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { UnifiedBatchingService } from './unified-batching.service';
import { RoutingCoordinationService } from './routing-coordination.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';
import { SharedTransactionService } from './shared-transaction.service';
import { SegmentPlanningService } from './segment-planning.service';
import { OrderManagementService } from './order-management.service';
import { RoutingIntegrationService } from './routing-integration.service';
import { TimelineCoordinationService } from './timeline-coordination.service';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import { CreateStopRequest, Trip } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

@Injectable()
export class StopCoordinationService {
  private readonly logger = new Logger(StopCoordinationService.name);

  constructor(
    private readonly tripService: TripService,
    private readonly stopService: StopService,
    private readonly unifiedBatchingService: UnifiedBatchingService,
    private readonly sharedValidationService: SharedValidationService,
    private readonly segmentPlanningService: SegmentPlanningService,
    private readonly orderManagementService: OrderManagementService,
    private readonly routingIntegrationService: RoutingIntegrationService,
  ) {}

  /**
   * UNIFIED BATCHING: Reorder stops using the enhanced UnifiedBatchingService.
   * All complex orchestration is now handled by the UnifiedBatchingService
   * which leverages our entire advanced service ecosystem.
   *
   * @param userId - User ID who owns the trip.
   * @param data - Reorder data.
   * @param prismaClient - Prisma client for transaction management.
   * @return The updated trip with reordered stops.
   */
  async reorderStopsWithBatching(
    userId: string,
    data: ItineraryReorderStopsDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    this.logger.debug(
      `[UNIFIED BATCHING] Reordering stops in trip ${data.tripId} for user ${userId}`,
    );

    // Step 1: Load trip with full data
    const trip = await this.tripService.findById(data.tripId, true, true, true, prismaClient);
    if (!trip) {
      throw new NotFoundException(`Trip ${data.tripId} not found`);
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedException(`Trip ${data.tripId} not owned by user`);
    }

    // Step 2: Execute comprehensive batch operation using enhanced UnifiedBatchingService
    const batchResult = await this.unifiedBatchingService.executeReorderingBatch(
      trip,
      data,
      prismaClient,
    );

    this.logger.log(
      `[UNIFIED BATCHING] Successfully reordered stops in trip ${data.tripId}: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
    );

    // Step 3: Return the complete updated trip
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }

  /**
   * TRUE BATCHING: Add a stop to a trip using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where location creation, stop insertion, order adjustments,
   * routing calculation, and timeline calculation are all pre-calculated and applied atomically.
   *
   * @param trip - Full trip object to add the stop to.
   * @param data - Stop addition data.
   * @param prismaClient - Prisma client for transaction management.
   * @return The updated trip with the new stop.
   */
  async addStopToTripWithBatching(
    trip: Trip,
    data: AddStopToTripDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    this.logger.debug(`[REFACTORED BATCHING] Adding stop to trip ${data.tripId}`);

    // Step 1: Validate and prepare location data
    const location = await this.validateAndPrepareLocation(data.locationId, prismaClient);

    // Step 2: Calculate insertion order and stop order changes
    const { insertOrder, stopOrderChanges } = await this.calculateInsertionDetails(
      trip,
      data,
      prismaClient,
    );

    // Step 3: Create the new stop first (needed for accurate routing)
    const newStop = await this.createNewStop(data, insertOrder, prismaClient);

    // Step 4: Reload trip with new stop and refresh matrix
    const updatedTrip = await this.reloadTripWithNewStop(data.tripId, prismaClient);

    // Step 5: Plan segments and acquire routing data
    const routingResult = await this.planSegmentsForStopInsertion(
      updatedTrip,
      newStop,
      data,
      insertOrder,
    );

    // Step 6: Execute comprehensive batch update
    const batchResult = await this.unifiedBatchingService.executeCompleteBatch(
      data.tripId,
      stopOrderChanges,
      routingResult.routingData,
      true, // calculateTimeline
      undefined, // startTime
      prismaClient,
      updatedTrip,
    );

    this.logger.log(
      `[REFACTORED BATCHING] Successfully added stop ${newStop.id} to trip ${data.tripId}: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
    );

    // Step 7: Return final trip state
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }

  /**
   * Validate location exists and return location data.
   */
  private async validateAndPrepareLocation(
    locationId: string,
    prismaClient: PrismaClientOrTransaction,
  ) {
    const locationValidation = await this.sharedValidationService.validateLocationExists(
      locationId,
      prismaClient,
    );

    if (!locationValidation.isValid) {
      throw new NotFoundException(locationValidation.errors.join(', '));
    }

    return locationValidation.location!;
  }

  /**
   * Calculate insertion order and necessary stop order changes.
   */
  private async calculateInsertionDetails(
    trip: Trip,
    data: AddStopToTripDto,
    prismaClient: PrismaClientOrTransaction,
  ) {
    const insertOrder =
      data.insertAtOrder !== undefined
        ? data.insertAtOrder
        : await this.stopService.getNextOrderForTrip(data.tripId, prismaClient);

    // Use order management service for proper insertion logic
    const { updates: stopOrderChanges } = this.orderManagementService.createInsertionOrderUpdates(
      trip.stops || [],
      insertOrder,
    );

    return {
      insertOrder,
      stopOrderChanges: stopOrderChanges.map(update => ({
        stopId: update.id,
        newOrder: update.order,
      })),
    };
  }

  /**
   * Create the new stop in the database.
   */
  private async createNewStop(
    data: AddStopToTripDto,
    insertOrder: number,
    prismaClient: PrismaClientOrTransaction,
  ) {
    const stopData: CreateStopRequest = {
      tripId: data.tripId,
      locationId: data.locationId,
      order: insertOrder,
      stopType: 'PITSTOP',
      plannedDuration: null,
    };

    return await this.stopService.create(stopData, prismaClient);
  }

  /**
   * Reload trip with new stop and refresh matrix data.
   */
  private async reloadTripWithNewStop(tripId: string, prismaClient: PrismaClientOrTransaction) {
    // Refresh matrix to include new stop
    await this.tripService.refreshMatrixOnStopAddition(tripId, prismaClient);

    // Reload trip with updated matrix
    const updatedTrip = await this.tripService.findById(tripId, true, true, true, prismaClient);

    if (!updatedTrip) {
      throw new Error(`Failed to reload trip ${tripId} after stop creation`);
    }

    return updatedTrip;
  }

  /**
   * Plan segments and acquire routing data for stop insertion.
   */
  private async planSegmentsForStopInsertion(
    trip: Trip,
    newStop: any,
    data: AddStopToTripDto,
    insertOrder: number,
  ) {
    // Find the added stop index in the sorted stops
    const sortedStops = [...(trip.stops || [])].sort((a, b) => a.order - b.order);
    const addedStopIndex = sortedStops.findIndex(stop => stop.id === newStop.id);

    if (addedStopIndex === -1) {
      throw new Error(`New stop ${newStop.id} not found in updated trip stops`);
    }

    // Use segment planning service for insertion
    const planningResult = await this.segmentPlanningService.planInsertionSegments(
      trip,
      sortedStops,
      addedStopIndex,
      trip.matrix,
      {
        includeAllDownstream: true,
        travelMode: data.travelMode as TravelMode,
      },
    );

    // Acquire routing data using routing integration service
    const routingStrategy = this.routingIntegrationService.getOptimalStrategy(
      planningResult.segmentPairs.length,
      !!trip.matrix,
      !data.calculateRouting, // prefer speed when not calculating full routing
      data.calculateRouting || false, // require accuracy when calculating routing
    );

    const routingResult = await this.routingIntegrationService.acquireRoutingData({
      segmentPairs: planningResult.segmentPairs,
      stops: sortedStops,
      trip: trip,
      strategy: routingStrategy,
      travelMode: data.travelMode as TravelMode,
      matrix: trip.matrix,
    });

    return routingResult;
  }

  /**
   * UNIFIED BATCHING: Remove a stop from a trip using the enhanced UnifiedBatchingService.
   * All complex orchestration is now handled by the UnifiedBatchingService
   * which leverages our entire advanced service ecosystem.
   *
   * @param trip - Full trip object to remove the stop from.
   * @param data - Stop removal data.
   * @param prismaClient - Prisma client for transaction management.
   * @return The updated trip without the removed stop.
   */
  async removeStopFromTripWithBatching(
    trip: Trip,
    data: RemoveStopFromTripDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    this.logger.debug(`[UNIFIED BATCHING] Removing stop ${data.stopId} from trip ${data.tripId}`);

    // Execute comprehensive stop removal using enhanced UnifiedBatchingService
    const batchResult = await this.unifiedBatchingService.executeStopRemovalBatch(
      trip,
      data,
      prismaClient,
    );

    this.logger.log(
      `[UNIFIED BATCHING] Successfully removed stop ${data.stopId} from trip ${data.tripId}: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
    );

    // Return the complete updated trip
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }
}

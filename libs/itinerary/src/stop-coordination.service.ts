import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { UnifiedBatchingService } from './unified-batching.service';
import { RoutingCoordinationService } from './routing-coordination.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import { CreateStopRequest, Trip, TravelSegment, CoordinateMatrix, toCoordinateKey } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

interface SegmentRoutingData {
  originStopId: string;
  destinationStopId: string;
  travelMode: TravelMode;
  apiCalculatedDistance: number | null;
  apiCalculatedDuration: number | null;
  polyline: string | null;
}

@Injectable()
export class StopCoordinationService {
  private readonly logger = new Logger(StopCoordinationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
    private readonly unifiedBatchingService: UnifiedBatchingService,
    private readonly routingCoordinationService: RoutingCoordinationService,
    private readonly sharedValidationService: SharedValidationService,
    private readonly sharedLocationProcessingService: SharedLocationProcessingService,
  ) {}

  /**
   * Add a stop to a trip with all cascading effects.
   * Handles location creation, stop insertion, and travel segment updates.
   * Note: Timeline recalculation is handled by the itinerary service.
   * @param userId - User ID who owns the trip.
   * @param data - Stop data to add.
   * @return The updated trip with all stops.
   */
  async addStopToTrip(userId: string, data: AddStopToTripDto): Promise<Trip> {
    this.logger.debug(`Adding stop to trip ${data.tripId} for user ${userId}`);

    return this.prismaService.$transaction(async (prismaClient: PrismaClientOrTransaction) => {
      // Step 1: Validate trip ownership
      const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
        data.tripId,
        userId,
        prismaClient,
      );

      if (!tripBelongsToUser) {
        throw new NotFoundException(`Trip ${data.tripId} not found or not owned by user`);
      }

      // Step 2: Use existing location ID directly (no creation needed)
      this.logger.debug(`Using existing location ${data.locationId} for stop creation`);

      // Step 3: Determine insertion order
      let insertOrder: number;
      if (data.insertAtOrder !== undefined) {
        insertOrder = data.insertAtOrder;
        // Make room for the new stop by reordering existing stops
        await this.makeRoomForStop(data.tripId, insertOrder, prismaClient);
      } else {
        // Add to the end
        insertOrder = await this.stopService.getNextOrderForTrip(data.tripId, prismaClient);
      }

      // Step 4: Create the stop
      const stopData: CreateStopRequest = {
        tripId: data.tripId,
        locationId: data.locationId,
        order: insertOrder,
        stopType: 'PITSTOP',
        plannedDuration: null,
      };

      const stop = await this.stopService.create(stopData, prismaClient);
      this.logger.debug(`Created stop ${stop.id} at order ${insertOrder}`);

      // Step 5: Update travel segments for the affected stops
      await this.updateTravelSegmentsAfterStopInsertion(data.tripId, insertOrder, prismaClient);

      // Step 6: Refresh matrix for persisted trips (to include new stop in matrix calculations)
      await this.tripService.refreshMatrixOnStopAddition(data.tripId, prismaClient);

      // Step 7: Set dirty flags for routing and timeline recalculation
      await this.tripService.updateTripDirtyFlags(data.tripId, true, true, prismaClient);

      // Step 8: Return the complete trip
      const completeTrip = await this.tripService.findById(
        data.tripId,
        true,
        false,
        true,
        prismaClient,
      );

      this.logger.log(`Successfully added stop ${stop.id} to trip ${data.tripId}`);
      return completeTrip;
    });
  }


  /**
   * Remove a stop from a trip with all cascading effects.
   * Handles stop removal and travel segment cleanup.
   * Note: Timeline recalculation is handled by the itinerary service.
   * @param userId - User ID who owns the trip.
   * @param data - Stop removal data.
   * @return The updated trip with remaining stops.
   */
  async removeStopFromTrip(userId: string, data: RemoveStopFromTripDto): Promise<Trip> {
    this.logger.debug(`Removing stop ${data.stopId} from trip ${data.tripId} for user ${userId}`);

    return await this.prismaService.$transaction(
      async (prismaClient: PrismaClientOrTransaction) => {
        // Step 1: Validate trip ownership
        const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
          data.tripId,
          userId,
          prismaClient,
        );

        if (!tripBelongsToUser) {
          throw new NotFoundException(`Trip ${data.tripId} not found or not owned by user`);
        }

        // Step 2: Get the stop to remove
        const stopToRemove = await this.stopService.findById(data.stopId, false, prismaClient);

        if (!stopToRemove || stopToRemove.tripId !== data.tripId) {
          throw new NotFoundException(`Stop ${data.stopId} not found in trip ${data.tripId}`);
        }

        // Step 3: Remove travel segments associated with this stop
        await this.travelSegmentService.deleteByStopId(data.stopId, prismaClient);

        // Step 4: Remove the stop
        await this.stopService.delete(data.stopId, prismaClient);
        this.logger.debug(`Removed stop ${data.stopId} from order ${stopToRemove.order}`);

        // Step 5: Reorder remaining stops to fill the gap
        await this.reorderStopsAfterRemoval(data.tripId, stopToRemove.order, prismaClient);

        // Step 6: Recreate travel segments between remaining stops
        await this.recreateTravelSegmentsAfterRemoval(data.tripId, prismaClient);

        // Step 7: Set dirty flags for routing and timeline recalculation
        await this.tripService.updateTripDirtyFlags(data.tripId, true, true, prismaClient);

        // Step 8: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          false,
          true,
          prismaClient,
        );

        this.logger.log(`Successfully removed stop ${data.stopId} from trip ${data.tripId}`);
        return completeTrip;
      },
    );
  }

  /**
   * Reorder stops in a trip with all cascading effects.
   * Handles stop reordering and travel segment updates.
   * Note: Timeline recalculation is handled by the itinerary service.
   * @param userId - User ID who owns the trip.
   * @param data - Reorder data.
   * @return The updated trip with reordered stops.
   */
  async reorderStops(userId: string, data: ItineraryReorderStopsDto): Promise<Trip> {
    this.logger.debug(`Reordering stops in trip ${data.tripId} for user ${userId}`);

    return await this.prismaService.$transaction(
      async (prismaClient: PrismaClientOrTransaction) => {
        // Step 1: Validate trip ownership
        const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
          data.tripId,
          userId,
          prismaClient,
        );

        if (!tripBelongsToUser) {
          throw new NotFoundException(`Trip ${data.tripId} not found or not owned by user`);
        }

        // Step 2: Validate stop orders using shared service
        this.sharedValidationService.validateStopOrders(data.stopOrders);

        // Step 3: Update stop orders
        for (const stopOrder of data.stopOrders) {
          await this.stopService.updateOrder(stopOrder.stopId, stopOrder.newOrder, prismaClient);
          this.logger.debug(`Updated stop ${stopOrder.stopId} to order ${stopOrder.newOrder}`);
        }

        // Step 4: Remove existing travel segments
        await this.travelSegmentService.deleteByTripId(data.tripId, prismaClient);

        // Step 5: Recreate travel segments with new ordering
        await this.recreateTravelSegmentsAfterReorder(data.tripId, prismaClient);

        // Step 6: Set dirty flags for routing and timeline recalculation
        await this.tripService.updateTripDirtyFlags(data.tripId, true, true, prismaClient);

        // Step 7: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          true,
          true,
          prismaClient,
        );

        this.logger.log(`Successfully reordered stops in trip ${data.tripId}`);
        return completeTrip;
      },
    );
  }

  /**
   * Make room for a new stop by incrementing the order of existing stops.
   * @param tripId - Trip ID.
   * @param insertOrder - Order position to insert at.
   * @param prismaClient - Prisma client for transaction.
   */
  async makeRoomForStop(
    tripId: string,
    insertOrder: number,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get all stops at or after the insertion point
    const stopsToReorder = await this.stopService.findByTripId(tripId, false, prismaClient);
    const stopsAfterInsertionPoint = stopsToReorder.filter(stop => stop.order >= insertOrder);

    // Increment order for each stop after insertion point
    for (const stop of stopsAfterInsertionPoint) {
      await this.stopService.updateOrder(stop.id as string, stop.order + 1, prismaClient);
    }
  }

  /**
   * Update travel segments after a stop insertion.
   * @param tripId - Trip ID.
   * @param insertOrder - Order position where stop was inserted.
   * @param prismaClient - Prisma client for transaction.
   */
  private async updateTravelSegmentsAfterStopInsertion(
    tripId: string,
    insertOrder: number,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // For now, we'll recreate all travel segments for the trip
    // This is less efficient but ensures correctness
    await this.travelSegmentService.deleteByTripId(tripId, prismaClient);
    await this.recreateTravelSegmentsAfterReorder(tripId, prismaClient);
  }

  /**
   * Reorder stops after removal to fill the gap.
   * @param tripId - Trip ID.
   * @param removedOrder - Order position that was removed.
   * @param prismaClient - Prisma client for transaction.
   */
  private async reorderStopsAfterRemoval(
    tripId: string,
    removedOrder: number,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get all remaining stops after the removed position
    const stopsToReorder = await this.stopService.findByTripId(tripId, false, prismaClient);
    const stopsAfterRemovedPosition = stopsToReorder.filter(stop => stop.order > removedOrder);

    // Decrement order for each stop after the removed position
    for (const stop of stopsAfterRemovedPosition) {
      await this.stopService.updateOrder(stop.id as string, stop.order - 1, prismaClient);
    }
  }

  /**
   * Recreate travel segments after stop removal.
   * @param tripId - Trip ID.
   * @param prismaClient - Prisma client for transaction.
   */
  private async recreateTravelSegmentsAfterRemoval(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    await this.recreateTravelSegmentsAfterReorder(tripId, prismaClient);
  }

  /**
   * Recreate travel segments after reordering.
   * @param tripId - Trip ID.
   * @param prismaClient - Prisma client for transaction.
   */
  private async recreateTravelSegmentsAfterReorder(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get all stops to ensure we have at least 2 stops
    const stops = await this.stopService.findByTripId(tripId, false, prismaClient);

    if (stops.length < 2) {
      this.logger.debug(`Trip ${tripId} has fewer than 2 stops, skipping travel segment creation`);
      return;
    }

    // Create basic travel segments between consecutive stops
    const stopIds = stops.map(stop => stop.id as string);
    await this.travelSegmentService.createSegmentsBetweenStops(tripId, stopIds, prismaClient);
  }

  /**
   * TRUE BATCHING: Reorder stops using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where each stop is updated once with all changes:
   * order, calculated times, and any other metadata in a single database operation.
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
    this.logger.debug(`[TRUE BATCHING] Reordering stops in trip ${data.tripId} for user ${userId}`);

    // Step 1: Validate trip ownership
    const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
      data.tripId,
      userId,
      prismaClient,
    );

    if (!tripBelongsToUser) {
      throw new NotFoundException(`Trip ${data.tripId} not found or not owned by user`);
    }

    // Step 2: Validate stop orders using shared service
    this.sharedValidationService.validateStopOrders(data.stopOrders);

    // Step 3: Calculate routing data if requested (external API calls)
    let routingData: Array<{
      originStopId: string;
      destinationStopId: string;
      travelMode: TravelMode;
      apiCalculatedDistance: number | null;
      apiCalculatedDuration: number | null;
      polyline: string | null;
    }> = [];

    if (data.calculateRouting) {
      // Load trip to get routing requirements
      const trip = await this.tripService.findById(data.tripId, true, false, true, prismaClient);
      if (trip && trip.stops && trip.stops.length >= 2) {
        const newSegmentPairs = this.calculateNewSegmentPairs(trip, data.stopOrders);
        const routingResults =
          await this.routingCoordinationService.calculateRoutingForSegmentPairs(
            newSegmentPairs,
            trip,
            data.travelMode as TravelMode,
          );

        // Convert routing results to format expected by UnifiedBatchingService
        routingData = routingResults.map(result => result.routingData);
      }
    } else {
      // Use matrix data for timeline construction without full routing
      this.logger.debug(`Using matrix data for timeline construction in trip ${data.tripId}`);
      
      // Load trip to get matrix data and segment requirements
      const trip = await this.tripService.findById(data.tripId, true, false, true, prismaClient);
      if (trip && trip.stops && trip.stops.length >= 2) {
        const newSegmentPairs = this.calculateNewSegmentPairs(trip, data.stopOrders);
        
        if (newSegmentPairs.length > 0) {
          // Transform matrix data to routing format for timeline construction
          routingData = this.transformMatrixToRoutingData(
            trip,
            newSegmentPairs,
            data.travelMode as TravelMode,
          );
        }
      }
    }

    // Step 4: Execute complete batch using UnifiedBatchingService
    // This performs all calculations in-memory, then applies everything atomically
    const batchResult = await this.unifiedBatchingService.executeCompleteBatch(
      data.tripId,
      data.stopOrders,
      routingData,
      true, // calculateTimeline
      undefined, // startTime (use trip default)
      prismaClient,
    );

    this.logger.log(
      `[TRUE BATCHING] Successfully reordered ${batchResult.updatedStops.length} stops in trip ${data.tripId}: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
    );

    // Step 5: Return the complete updated trip
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }

  /**
   * Identify all segments that reference any of the reordered stops.
   * PURE FUNCTION: No database calls, operates on loaded trip data.
   * @param trip - Full trip with stops and segments.
   * @param newStopOrders - New stop orders.
   * @return Array of segments that will conflict with reordering.
   */
  private identifyAllConflictingSegments(
    trip: Trip,
    newStopOrders: { stopId: string; newOrder: number }[],
  ): TravelSegment[] {
    if (!trip.travelSegments || trip.travelSegments.length === 0) {
      return [];
    }

    // Get all stop IDs that are being reordered
    const reorderedStopIds = new Set(newStopOrders.map(so => so.stopId));

    // Find all segments that reference any reordered stop
    return trip.travelSegments.filter(
      segment =>
        reorderedStopIds.has(segment.originStopId) ||
        reorderedStopIds.has(segment.destinationStopId),
    );
  }

  /**
   * Calculate the new segment pairs needed for the reordered stops.
   * PURE FUNCTION: No database calls, operates on loaded trip data.
   * @param trip - Full trip with stops.
   * @param newStopOrders - New stop orders.
   * @return Array of origin-destination pairs for new segments.
   */
  private calculateNewSegmentPairs(
    trip: Trip,
    newStopOrders: { stopId: string; newOrder: number }[],
  ): Array<{ originStopId: string; destinationStopId: string; tripId: string }> {
    if (!trip.stops || trip.stops.length < 2) {
      return [];
    }

    // Create mapping of stop IDs to their new orders
    const stopOrderMap = new Map(newStopOrders.map(so => [so.stopId, so.newOrder]));
    const reorderedStopIds = new Set(newStopOrders.map(so => so.stopId));

    // Build new stop ordering (all stops, with updated orders for reordered ones)
    const newStopOrdering = [...trip.stops].sort((a, b) => {
      const aNewOrder = stopOrderMap.get(a.id as string) ?? a.order;
      const bNewOrder = stopOrderMap.get(b.id as string) ?? b.order;
      return aNewOrder - bNewOrder;
    });

    // Create segment pairs only between consecutive stops where at least one is reordered
    const newSegmentPairs: Array<{
      originStopId: string;
      destinationStopId: string;
      tripId: string;
    }> = [];

    for (let i = 0; i < newStopOrdering.length - 1; i++) {
      const originStopId = newStopOrdering[i].id as string;
      const destinationStopId = newStopOrdering[i + 1].id as string;

      // Only create segment if at least one stop was reordered
      if (reorderedStopIds.has(originStopId) || reorderedStopIds.has(destinationStopId)) {
        newSegmentPairs.push({
          originStopId,
          destinationStopId,
          tripId: trip.id,
        });
      }
    }

    return newSegmentPairs;
  }

  /**
   * Prepare batched stop updates as PrismaPromise array.
   * @param stopOrderChanges - Stop order changes to apply.
   * @param prismaClient - Prisma client for transaction.
   * @return Array of PrismaPromise for stop updates.
   */
  private prepareBatchedStopUpdates(
    stopOrderChanges: { stopId: string; newOrder: number }[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<{ id: string; order: number }>[] {
    return stopOrderChanges.map(change =>
      prismaClient.stop.update({
        where: { id: change.stopId },
        data: { order: change.newOrder },
      }),
    );
  }

  /**
   * Create new segments with routing data, preserving data from deleted segments where possible.
   * @param newSegmentPairs - New segment pairs to create.
   * @param deletedSegments - Segments that were deleted (for data preservation).
   * @param routingUpdates - Routing data for new segments (empty if calculateRouting=false).
   * @param prismaClient - Prisma client for transaction.
   */
  private async createNewSegmentsWithRouting(
    newSegmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }>,
    deletedSegments: TravelSegment[],
    routingUpdates: Array<{
      originStopId: string;
      destinationStopId: string;
      routingData: SegmentRoutingData;
    }>,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Create maps for efficient lookups
    const routingMap = new Map(
      routingUpdates.map(r => [`${r.originStopId}-${r.destinationStopId}`, r.routingData]),
    );
    const deletedSegmentMap = new Map(
      deletedSegments.map(s => [`${s.originStopId}-${s.destinationStopId}`, s]),
    );

    // Create new segments
    const createOperations = newSegmentPairs.map(segmentPair => {
      const segmentKey = `${segmentPair.originStopId}-${segmentPair.destinationStopId}`;
      const routingData = routingMap.get(segmentKey);
      const originalSegment = deletedSegmentMap.get(segmentKey);

      // Build segment data, preserving from original where possible
      const segmentData = {
        tripId: segmentPair.tripId,
        originStopId: segmentPair.originStopId,
        destinationStopId: segmentPair.destinationStopId,
        travelMode: routingData?.travelMode ?? originalSegment?.travelMode,
        distance: originalSegment?.distance,
        duration: originalSegment?.duration,
        apiCalculatedDistance:
          routingData?.apiCalculatedDistance ?? originalSegment?.apiCalculatedDistance,
        apiCalculatedDuration:
          routingData?.apiCalculatedDuration ?? originalSegment?.apiCalculatedDuration,
        polyline: routingData?.polyline ?? originalSegment?.polyline,
        routeOptions: originalSegment?.routeOptions,
        notes: originalSegment?.notes,
      };

      return prismaClient.travelSegment.create({
        data: segmentData,
      });
    });

    // Execute all create operations in parallel
    await Promise.all(createOperations);
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
    this.logger.debug(`[TRUE BATCHING] Adding stop to trip ${data.tripId}`);

    // Step 3: Get location data (needed for routing calculations)
    const location = await this.locationService.findById(data.locationId, prismaClient);
    if (!location) {
      throw new NotFoundException(`Location ${data.locationId} not found`);
    }
    this.logger.debug(`Using existing location ${data.locationId} for batched stop creation`);

    // Step 4: Calculate stop order changes for insertion
    const insertOrder =
      data.insertAtOrder !== undefined
        ? data.insertAtOrder
        : await this.stopService.getNextOrderForTrip(data.tripId, prismaClient);

    const stopOrderChanges =
      this.sharedLocationProcessingService.calculateStopOrderChangesForInsertion(
        trip.stops || [],
        insertOrder,
      );

    // Step 5: Calculate routing data if requested
    let routingData: Array<{
      originStopId: string;
      destinationStopId: string;
      travelMode: TravelMode;
      apiCalculatedDistance: number | null;
      apiCalculatedDuration: number | null;
      polyline: string | null;
    }> = [];

    if (data.calculateRouting) {
      // Calculate new segment pairs that will include the new stop
      const newStopId = `temp-new-stop-${Date.now()}`; // Temporary ID for calculation
      const segmentPairs = this.calculateSegmentPairsForStopInsertion(
        trip,
        newStopId,
        insertOrder,
        location,
      );

      if (segmentPairs.length > 0) {
        const routingResults =
          await this.routingCoordinationService.calculateRoutingForSegmentPairs(
            segmentPairs,
            trip,
            data.travelMode as TravelMode,
          );
        routingData = routingResults.map(result => result.routingData);
      }
    }

    // Step 6: Create the new stop in database first (needed for routing data mapping)
    const stopData: CreateStopRequest = {
      tripId: data.tripId,
      locationId: data.locationId,
      order: insertOrder,
      stopType: 'PITSTOP',
      plannedDuration: null,
    };

    const newStop = await this.stopService.create(stopData, prismaClient);

    // Step 7: Reload trip data to include the newly created stop
    const updatedTrip = await this.tripService.findById(
      data.tripId,
      true,
      true,
      true,
      prismaClient,
    );
    if (!updatedTrip) {
      throw new Error(`Failed to reload trip ${data.tripId} after stop creation`);
    }

    // Step 8: Map temporary stop ID to real stop ID in routing data (for full routing only)
    if (data.calculateRouting) {
      routingData = routingData.map(segment => ({
        ...segment,
        originStopId: segment.originStopId.startsWith('temp-new-stop-')
          ? (newStop.id as string)
          : segment.originStopId,
        destinationStopId: segment.destinationStopId.startsWith('temp-new-stop-')
          ? (newStop.id as string)
          : segment.destinationStopId,
      }));
    }

    // Step 9: Refresh matrix for the trip (to include new stop in matrix calculations)
    await this.tripService.refreshMatrixOnStopAddition(data.tripId, prismaClient);

    // Step 10: Handle matrix-based routing data if not using full routing (AFTER matrix refresh)
    if (!data.calculateRouting) {
      // Use matrix data for timeline construction without full routing
      this.logger.debug(`Using matrix data for timeline construction in trip ${data.tripId}`);
      
      // Reload trip again to get the updated matrix data
      const tripWithNewMatrix = await this.tripService.findById(
        data.tripId,
        true,
        true,
        true,
        prismaClient,
      );
      
      if (tripWithNewMatrix) {
        // Calculate segment pairs for the added stop using updated trip data
        const segmentPairs = this.calculateSegmentPairsAfterStopAddition(
          tripWithNewMatrix, // Use trip with refreshed matrix
          newStop.id as string, // Real stop ID
        );

        if (segmentPairs.length > 0) {
          // Transform matrix data to routing format for timeline construction
          routingData = this.transformMatrixToRoutingData(
            tripWithNewMatrix, // Use trip data with refreshed matrix
            segmentPairs,
            data.travelMode as TravelMode,
          );
        }
      }
    }

    // Step 11: Execute batch updates using UnifiedBatchingService with updated trip data
    const batchResult = await this.unifiedBatchingService.executeCompleteBatch(
      data.tripId,
      stopOrderChanges,
      routingData,
      true, // calculateTimeline
      undefined, // startTime
      prismaClient,
      updatedTrip, // Pass the updated trip data that includes the new stop
    );

    this.logger.log(
      `[TRUE BATCHING] Successfully added stop ${newStop.id} to trip ${data.tripId}: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
    );

    // Step 12: Return the complete updated trip
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }

  /**
   * Calculate segment pairs needed when inserting a new stop.
   * PURE FUNCTION: Works with in-memory data and location information.
   * @param trip - Full trip with stops and locations.
   * @param newStopId - Temporary ID for the new stop.
   * @param insertOrder - Order position where stop will be inserted.
   * @param newLocation - Location data for the new stop.
   * @return Array of segment pairs that need routing.
   */
  private calculateSegmentPairsForStopInsertion(
    trip: Trip,
    newStopId: string,
    insertOrder: number,
    newLocation: any, // Location type
  ): Array<{ originStopId: string; destinationStopId: string; tripId: string }> {
    if (!trip.stops || trip.stops.length === 0) {
      return [];
    }

    const sortedStops = [...trip.stops].sort((a, b) => a.order - b.order);
    const segmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }> =
      [];

    // Create virtual new stop for calculation
    const newVirtualStop = {
      id: newStopId,
      createdAt: new Date(),
      updatedAt: new Date(),
      tripId: trip.id,
      locationId: newLocation.id,
      order: insertOrder,
      plannedArrivalTime: null,
      plannedDuration: null,
      calculatedArrivalTime: null,
      calculatedDepartureTime: null,
      stopType: null,
      notes: null,
      alias: null,
      location: newLocation,
    };

    // Insert the new virtual stop in the correct position
    let adjustedStops = [...sortedStops];

    // Adjust orders for stops at or after insertion point
    adjustedStops = adjustedStops.map(stop => ({
      ...stop,
      order: stop.order >= insertOrder ? stop.order + 1 : stop.order,
    }));

    // Insert the new stop
    adjustedStops.push(newVirtualStop);
    adjustedStops.sort((a, b) => a.order - b.order);

    // Find the position of the new stop in the sorted array
    const newStopIndex = adjustedStops.findIndex(stop => stop.id === newStopId);

    // Create segments involving the new stop
    if (newStopIndex > 0) {
      // Segment from previous stop to new stop
      segmentPairs.push({
        originStopId: adjustedStops[newStopIndex - 1].id as string,
        destinationStopId: newStopId,
        tripId: trip.id,
      });
    }

    if (newStopIndex < adjustedStops.length - 1) {
      // Segment from new stop to next stop
      segmentPairs.push({
        originStopId: newStopId,
        destinationStopId: adjustedStops[newStopIndex + 1].id as string,
        tripId: trip.id,
      });
    }

    return segmentPairs;
  }

  /**
   * TRUE BATCHING: Remove a stop from a trip using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where stop deletion, order adjustments, routing calculation,
   * and timeline calculation are all pre-calculated and applied atomically.
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
    this.logger.debug(`[TRUE BATCHING] Removing stop ${data.stopId} from trip ${data.tripId}ty`);

    // Step 3: Validate stop exists and belongs to trip
    const stopToRemove = trip.stops?.find(stop => stop.id === data.stopId);
    if (!stopToRemove) {
      throw new NotFoundException(`Stop ${data.stopId} not found in trip ${data.tripId}`);
    }

    // Step 4: Calculate stop order changes for remaining stops (pure function)
    const stopOrderChanges =
      this.sharedLocationProcessingService.calculateStopOrderChangesForRemoval(
        trip.stops || [],
        stopToRemove.order,
      );

    // Step 5: Calculate routing data if requested
    let routingData: Array<{
      originStopId: string;
      destinationStopId: string;
      travelMode: TravelMode;
      apiCalculatedDistance: number | null;
      apiCalculatedDuration: number | null;
      polyline: string | null;
    }> = [];

    if (data.calculateRouting) {
      // Calculate new segment pairs needed after removal
      const segmentPairs = this.calculateSegmentPairsForStopRemoval(trip, data.stopId);

      if (segmentPairs.length > 0) {
        const routingResults =
          await this.routingCoordinationService.calculateRoutingForSegmentPairs(
            segmentPairs,
            trip,
            data.travelMode as TravelMode,
          );
        routingData = routingResults.map(result => result.routingData);
      }
    } else {
      // Use matrix data for timeline construction without full routing
      this.logger.debug(`Using matrix data for timeline construction in trip ${data.tripId}`);
      
      // Calculate segment pairs needed after removal
      const segmentPairs = this.calculateSegmentPairsForStopRemoval(trip, data.stopId);

      if (segmentPairs.length > 0) {
        // Transform matrix data to routing format for timeline construction
        routingData = this.transformMatrixToRoutingData(
          trip,
          segmentPairs,
          data.travelMode as TravelMode,
        );
      }
    }

    // Step 6: Delete the target stop first (required for constraint integrity)
    await this.stopService.delete(data.stopId, prismaClient);
    this.logger.debug(
      `[TRUE BATCHING] Deleted stop ${data.stopId} from order ${stopToRemove.order}`,
    );

    // Step 7: Execute batch updates using UnifiedBatchingService (if there are remaining stops)
    if (stopOrderChanges.length > 0 || routingData.length > 0) {
      const batchResult = await this.unifiedBatchingService.executeCompleteBatch(
        data.tripId,
        stopOrderChanges,
        routingData,
        true, // calculateTimeline
        undefined, // startTime
        prismaClient,
      );

      this.logger.debug(
        `[TRUE BATCHING] Batch execution for stop removal: ${batchResult.totalOperations} operations in ${batchResult.executionTime}ms`,
      );
    } else {
      // If no remaining stops, just update dirty flags
      await this.tripService.updateTripDirtyFlags(data.tripId, true, true, prismaClient);
      this.logger.debug(`[TRUE BATCHING] No remaining stops - only updated dirty flags`);
    }

    this.logger.log(
      `[TRUE BATCHING] Successfully removed stop ${data.stopId} from trip ${data.tripId}`,
    );

    // Step 8: Return the complete updated trip
    return await this.tripService.findById(data.tripId, true, true, true, prismaClient);
  }

  /**
   * Calculate new segment pairs needed after removing a stop.
   * PURE FUNCTION: No database calls, operates on loaded trip data.
   * @param trip - Full trip with stops and current segments.
   * @param removedStopId - ID of the stop being removed.
   * @return Array of new segment pairs needed.
   */
  private calculateSegmentPairsForStopRemoval(
    trip: Trip,
    removedStopId: string,
  ): Array<{ originStopId: string; destinationStopId: string; tripId: string }> {
    const segmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }> =
      [];

    if (!trip.stops || trip.stops.length <= 2) {
      // If removing a stop leaves us with 1 or fewer stops, no segments needed
      return segmentPairs;
    }

    // Sort stops by order to get correct sequence
    const sortedStops = [...trip.stops].sort((a, b) => a.order - b.order);

    // Find the position of the removed stop
    const removedStopIndex = sortedStops.findIndex(stop => stop.id === removedStopId);
    if (removedStopIndex === -1) {
      return segmentPairs; // Stop not found, no changes needed
    }

    // If removing a middle stop, create a segment connecting the previous and next stops
    if (removedStopIndex > 0 && removedStopIndex < sortedStops.length - 1) {
      const previousStop = sortedStops[removedStopIndex - 1];
      const nextStop = sortedStops[removedStopIndex + 1];

      segmentPairs.push({
        originStopId: previousStop.id as string,
        destinationStopId: nextStop.id as string,
        tripId: trip.id as string,
      });
    }

    // If removing first or last stop, the existing segments will just be deleted
    // and the remaining consecutive stops will have their segments recreated by the batching service

    return segmentPairs;
  }

  /**
   * Calculate segment pairs involving a newly added stop.
   * Works with trip data after the stop has already been created.
   * @param trip - Full trip with stops including the newly added stop.
   * @param addedStopId - ID of the stop that was just added.
   * @return Array of segment pairs that involve the new stop.
   */
  private calculateSegmentPairsAfterStopAddition(
    trip: Trip,
    addedStopId: string,
  ): Array<{ originStopId: string; destinationStopId: string; tripId: string }> {
    const segmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }> = [];

    if (!trip.stops || trip.stops.length < 2) {
      return segmentPairs;
    }

    // Sort stops by order to get correct sequence
    const sortedStops = [...trip.stops].sort((a, b) => a.order - b.order);
    
    // Find the position of the added stop
    const addedStopIndex = sortedStops.findIndex(stop => stop.id === addedStopId);
    if (addedStopIndex === -1) {
      this.logger.warn(`Added stop ${addedStopId} not found in trip stops`);
      return segmentPairs;
    }

    // Create segments involving the new stop
    if (addedStopIndex > 0) {
      // Segment from previous stop to new stop
      segmentPairs.push({
        originStopId: sortedStops[addedStopIndex - 1].id as string,
        destinationStopId: addedStopId,
        tripId: trip.id,
      });
    }

    if (addedStopIndex < sortedStops.length - 1) {
      // Segment from new stop to next stop
      segmentPairs.push({
        originStopId: addedStopId,
        destinationStopId: sortedStops[addedStopIndex + 1].id as string,
        tripId: trip.id,
      });
    }

    return segmentPairs;
  }

  /**
   * Transform matrix routing data to routingData format for timeline construction.
   * Uses stored matrix data to create routing information without additional API calls.
   * @param trip - Full trip with stops and matrix data.
   * @param segmentPairs - Array of segment pairs that need routing data.
   * @param travelMode - Travel mode for the routing data.
   * @return Array of routing data formatted for UnifiedBatchingService.
   */
  private transformMatrixToRoutingData(
    trip: Trip,
    segmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }>,
    travelMode: TravelMode,
  ): Array<{
    originStopId: string;
    destinationStopId: string;
    travelMode: TravelMode;
    apiCalculatedDistance: number | null;
    apiCalculatedDuration: number | null;
    polyline: string | null;
  }> {
    const routingData: Array<{
      originStopId: string;
      destinationStopId: string;
      travelMode: TravelMode;
      apiCalculatedDistance: number | null;
      apiCalculatedDuration: number | null;
      polyline: string | null;
    }> = [];

    // Check if trip has matrix data
    let matrix: CoordinateMatrix | null = null;
    
    if (trip.matrix) {
      // Parse matrix data if it's a string, otherwise use as-is
      try {
        const matrixData = typeof trip.matrix === 'string' ? JSON.parse(trip.matrix) : trip.matrix;
        matrix = matrixData as CoordinateMatrix;
        
        this.logger.debug(`Raw matrix data type: ${typeof trip.matrix}`);
        this.logger.debug(`Parsed matrix keys: ${Object.keys(matrix).slice(0, 3).join(', ')}...`);
      } catch (error) {
        this.logger.error(`Failed to parse matrix data for trip ${trip.id}:`, error);
        return routingData;
      }
    }
    
    if (!matrix) {
      this.logger.warn(`Trip ${trip.id} has no matrix data, cannot transform to routing data`);
      return routingData;
    }

    this.logger.debug(`Matrix data found for trip ${trip.id}, keys: ${Object.keys(matrix).length}`);

    // Create a map of stop IDs to their locations for efficient lookup
    const stopLocationMap = new Map<string, { latitude: number; longitude: number }>();
    if (trip.stops) {
      for (const stop of trip.stops) {
        if (stop.location) {
          stopLocationMap.set(stop.id as string, {
            latitude: stop.location.latitude,
            longitude: stop.location.longitude,
          });
        }
      }
    }

    // Transform each segment pair using matrix data
    for (const segmentPair of segmentPairs) {
      const originLocation = stopLocationMap.get(segmentPair.originStopId);
      const destinationLocation = stopLocationMap.get(segmentPair.destinationStopId);

      if (!originLocation || !destinationLocation) {
        this.logger.warn(
          `Missing location data for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}`,
        );
        // Create segment without routing data
        routingData.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        });
        continue;
      }

      // Generate coordinate keys for matrix lookup
      const originKey = toCoordinateKey({
        lat: originLocation.latitude,
        lng: originLocation.longitude,
      });
      const destinationKey = toCoordinateKey({
        lat: destinationLocation.latitude,
        lng: destinationLocation.longitude,
      });

      this.logger.debug(`Looking up matrix data: ${originKey} -> ${destinationKey}`);

      // Look up data in matrix
      const matrixCell = matrix[originKey]?.[destinationKey];
      if (matrixCell) {
        // Transform matrix data to routing format
        // Matrix stores time in seconds, routing expects duration in minutes
        const durationMinutes = Math.round(matrixCell.time / 60);
        
        routingData.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode,
          apiCalculatedDistance: matrixCell.distance, // Matrix stores distance in meters
          apiCalculatedDuration: durationMinutes, // Convert seconds to minutes
          polyline: null, // Matrix data doesn't include polyline information
        });

        this.logger.debug(
          `Transformed matrix data for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}: ${matrixCell.distance}m, ${durationMinutes}min`,
        );
      } else {
        this.logger.warn(
          `Matrix data not found for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId} (${originKey} -> ${destinationKey})`,
        );
        // Create segment without routing data
        routingData.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        });
      }
    }

    return routingData;
  }
}

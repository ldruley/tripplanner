import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { RoutingService } from '@trip-planner/routing';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import {
  CreateLocationRequest,
  CreateStopRequest,
  Trip,
  TravelSegment,
  RoutingRequestSchema,
  RoutingResponse,
} from '@trip-planner/types';
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
    private readonly routingService: RoutingService,
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

      // Step 2: Create or find location (with deduplication)
      const locationData: CreateLocationRequest = {
        name: data.locationData.name,
        description: data.locationData.description,
        address: data.locationData.address,
        city: data.locationData.city,
        state: data.locationData.state,
        country: data.locationData.country,
        postalCode: data.locationData.postalCode,
        latitude: data.locationData.latitude,
        longitude: data.locationData.longitude,
        apiSource: data.locationData.apiSource,
        apiSourceId: data.locationData.apiSourceId,
        category: data.locationData.category,
        public: false, // Default to false, can be updated later
      };

      const location = await this.locationService.create(
        locationData,
        {
          enableApiSourceMatching: true,
          enableExactCoordinateMatching: true,
        },
        prismaClient,
      );
      this.logger.debug(`Created/found location ${location.id} for ${data.locationData.name}`);

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
        locationId: location.id as string,
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

        // Step 2: Validate stop orders
        this.validateStopOrders(data.stopOrders);

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
   * EXPERIMENTAL: Reorder stops using batched database operations and intelligent segment updates.
   * This is a proof of concept for reducing database operations through object mutation and batching.
   * @param userId - User ID who owns the trip.
   * @param data - Reorder data.
   * @return The updated trip with reordered stops.
   */
  async reorderStopsWithBatching(userId: string, data: ItineraryReorderStopsDto): Promise<Trip> {
    this.logger.debug(
      `[EXPERIMENTAL] Batched reordering stops in trip ${data.tripId} for user ${userId}`,
    );

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

        // Step 2: Validate stop orders
        this.validateStopOrders(data.stopOrders);

        // Step 3: Load full trip with all relations once
        const fullTrip = await this.tripService.findById(
          data.tripId,
          true, // includeStops
          true, // includeSegments
          true, // includeLocations
          prismaClient,
        );

        if (!fullTrip || !fullTrip.stops || fullTrip.stops.length === 0) {
          throw new NotFoundException(`Trip ${data.tripId} not found or has no stops`);
        }

        // Step 4: Calculate stop order changes (pure function)
        const stopOrderChanges = this.calculateStopOrderChanges(fullTrip, data.stopOrders);

        // Step 5: Identify all segments that reference reordered stops (pure function)
        const conflictingSegments = this.identifyAllConflictingSegments(
          fullTrip,
          data.stopOrders,
        );

        // Step 6: Calculate new segments for the reordered stops
        const newSegmentPairs = this.calculateNewSegmentPairs(fullTrip, data.stopOrders);

        // Step 7: Calculate routing updates if requested (pure function)
        let routingUpdates: Array<{ originStopId: string; destinationStopId: string; routingData: SegmentRoutingData }> = [];
        if (data.calculateRouting) {
          routingUpdates = await this.calculateRoutingForNewSegments(
            newSegmentPairs,
            fullTrip,
            data.travelMode as TravelMode,
          );
        }

        // Step 8: Execute batched operations with proper sequencing
        let operationCount = 0;
        
        // Execute stop updates and segment deletions in parallel (no conflicts)
        const parallelOperations: Promise<any>[] = [];
        
        if (stopOrderChanges.length > 0) {
          const stopUpdatePromises = this.prepareBatchedStopUpdates(stopOrderChanges, prismaClient);
          parallelOperations.push(...stopUpdatePromises);
          operationCount += stopUpdatePromises.length;
        }

        if (conflictingSegments.length > 0) {
          const segmentIds = conflictingSegments.map(s => s.id);
          parallelOperations.push(
            prismaClient.travelSegment.deleteMany({
              where: { id: { in: segmentIds } }
            })
          );
          operationCount += 1; // deleteMany counts as 1 operation
        }

        // Execute deletions and stop updates in parallel
        if (parallelOperations.length > 0) {
          await Promise.all(parallelOperations);
          this.logger.debug(`[EXPERIMENTAL] Executed ${operationCount} operations in parallel (stops + segment deletions)`);
        }

        // Create new segments after deletions are complete (avoids constraint conflicts)
        if (newSegmentPairs.length > 0) {
          await this.createNewSegmentsWithRouting(
            newSegmentPairs,
            conflictingSegments,
            routingUpdates,
            prismaClient,
          );
          this.logger.debug(`[EXPERIMENTAL] Created ${newSegmentPairs.length} new segments for reordered stops`);
        }

        // Step 9: Set dirty flags for timeline recalculation
        await this.tripService.updateTripDirtyFlags(data.tripId, false, true, prismaClient);

        // Step 10: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          true,
          true,
          prismaClient,
        );

        this.logger.log(
          `[EXPERIMENTAL] Successfully reordered stops in trip ${data.tripId} using batched operations`,
        );
        return completeTrip;
      },
    );
  }

  /**
   * Calculate which stops need order updates based on current state and new ordering.
   * PURE FUNCTION: No database calls, operates on loaded trip data.
   * @param trip - Full trip with stops and segments.
   * @param newStopOrders - New stop orders from the request.
   * @return Array of stop updates needed.
   */
  private calculateStopOrderChanges(
    trip: Trip,
    newStopOrders: { stopId: string; newOrder: number }[],
  ): { stopId: string; newOrder: number }[] {
    const stopOrderMap = new Map(newStopOrders.map(so => [so.stopId, so.newOrder]));
    const changes: { stopId: string; newOrder: number }[] = [];

    for (const stop of trip.stops || []) {
      const newOrder = stopOrderMap.get(stop.id as string);
      if (newOrder !== undefined && newOrder !== stop.order) {
        changes.push({ stopId: stop.id as string, newOrder });
      }
    }

    return changes;
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
    const conflictingSegments = trip.travelSegments.filter(segment =>
      reorderedStopIds.has(segment.originStopId) || reorderedStopIds.has(segment.destinationStopId)
    );

    return conflictingSegments;
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
    const newSegmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }> = [];

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
   * Calculate routing updates for new segment pairs.
   * Makes actual routing service calls to get distance, duration, and polyline data.
   * @param newSegmentPairs - New segment pairs that need routing.
   * @param trip - Full trip with stops and locations.
   * @param travelMode - Travel mode for routing.
   * @return Routing data for new segments.
   */
  private async calculateRoutingForNewSegments(
    newSegmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }>,
    trip: Trip,
    travelMode: TravelMode,
  ): Promise<Array<{ originStopId: string; destinationStopId: string; routingData: SegmentRoutingData }>> {
    if (newSegmentPairs.length === 0) {
      return [];
    }

    const routingUpdates: Array<{ originStopId: string; destinationStopId: string; routingData: SegmentRoutingData }> = [];

    for (const segmentPair of newSegmentPairs) {
      const originStop = trip.stops?.find(stop => stop.id === segmentPair.originStopId);
      const destinationStop = trip.stops?.find(stop => stop.id === segmentPair.destinationStopId);

      if (!originStop?.location || !destinationStop?.location) {
        this.logger.warn(`Missing location data for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}`);
        continue;
      }

      try {
        // Create waypoints for routing request
        const waypoints = [
          {
            latitude: originStop.location.latitude,
            longitude: originStop.location.longitude,
            name: originStop.location.name,
          },
          {
            latitude: destinationStop.location.latitude,
            longitude: destinationStop.location.longitude,
            name: destinationStop.location.name,
          },
        ];

        // Make actual routing service call
        const routingRequest = RoutingRequestSchema.parse({
          waypoints,
          options: {
            travelMode,
          },
        });

        const routingResult: RoutingResponse = await this.routingService.getRouting(routingRequest);

        this.logger.debug(
          `Calculated routing for new segment ${segmentPair.originStopId}-${segmentPair.destinationStopId} using ${routingResult.provider}: ${routingResult.route.distance}m, ${routingResult.route.duration}s`,
        );

        // Map routing result to segment creation format
        const routingData = {
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode: travelMode,
          apiCalculatedDistance: routingResult.route.distance,
          apiCalculatedDuration: Math.round(routingResult.route.duration / 60), // Convert seconds to minutes
          polyline: routingResult.route.geometry,
        };

        routingUpdates.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          routingData,
        });
      } catch (error) {
        this.logger.error(
          `Failed to calculate routing for new segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Fallback: create segment without routing data
        const routingData = {
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode: travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        };

        routingUpdates.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          routingData,
        });
      }
    }

    return routingUpdates;
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
    routingUpdates: Array<{ originStopId: string; destinationStopId: string; routingData: SegmentRoutingData }>,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Create maps for efficient lookups
    const routingMap = new Map(
      routingUpdates.map(r => [`${r.originStopId}-${r.destinationStopId}`, r.routingData])
    );
    const deletedSegmentMap = new Map(
      deletedSegments.map(s => [`${s.originStopId}-${s.destinationStopId}`, s])
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
        apiCalculatedDistance: routingData?.apiCalculatedDistance ?? originalSegment?.apiCalculatedDistance,
        apiCalculatedDuration: routingData?.apiCalculatedDuration ?? originalSegment?.apiCalculatedDuration,
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
   * Validate stop orders for reordering.
   * @param stopOrders - Stop orders to validate.
   */
  private validateStopOrders(stopOrders: { newOrder: number }[]): void {
    if (stopOrders.length === 0) {
      throw new BadRequestException('At least one stop order is required');
    }

    // Check for duplicate orders
    const orders = stopOrders.map(so => so.newOrder);
    const uniqueOrders = [...new Set(orders)];

    if (orders.length !== uniqueOrders.length) {
      throw new BadRequestException('Duplicate order values found in stop orders');
    }

    // Check for sequential ordering starting from 0
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);

    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i) {
        throw new BadRequestException(
          `Invalid ordering: expected order ${i} but found ${sortedOrders[i]}. Orders must be sequential starting from 0.`,
        );
      }
    }
  }
}

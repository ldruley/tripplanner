import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import {
  CreateLocationRequest,
  CreateStopRequest,
  Trip,
} from '@trip-planner/types';

@Injectable()
export class StopCoordinationService {
  private readonly logger = new Logger(StopCoordinationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
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
    this.logger.debug(`[EXPERIMENTAL] Batched reordering stops in trip ${data.tripId} for user ${userId}`);

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

        // Step 3: Get current stops and segments
        const currentStops = await this.stopService.findByTripId(data.tripId, false, prismaClient);
        const currentSegments = await this.travelSegmentService.findByTripId(data.tripId, prismaClient);

        // Step 4: Calculate stop order changes
        const stopOrderChanges = this.calculateStopOrderChanges(currentStops, data.stopOrders);

        // Step 5: Identify segments that need updates
        const segmentsRequiringUpdates = this.identifySegmentsRequiringUpdates(
          currentSegments,
          currentStops,
          data.stopOrders,
        );

        // Step 6: Prepare batched operations
        const stopUpdates = this.prepareBatchedStopUpdates(stopOrderChanges, prismaClient);
        const segmentUpdates = await this.prepareBatchedSegmentUpdates(
          segmentsRequiringUpdates,
          currentStops,
          data.stopOrders,
          prismaClient,
        );

        // Step 7: Execute all operations in a single transaction
        const allOperations = [...stopUpdates, ...segmentUpdates];
        
        if (allOperations.length > 0) {
          await Promise.all(allOperations);
          this.logger.debug(`[EXPERIMENTAL] Executed ${allOperations.length} batched operations`);
        }

        // Step 8: Set dirty flags for timeline recalculation
        await this.tripService.updateTripDirtyFlags(data.tripId, false, true, prismaClient);

        // Step 9: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          true,
          true,
          prismaClient,
        );

        this.logger.log(`[EXPERIMENTAL] Successfully reordered stops in trip ${data.tripId} using batched operations`);
        return completeTrip;
      },
    );
  }

  /**
   * Calculate which stops need order updates based on current state and new ordering.
   * @param currentStops - Current stops in the trip.
   * @param newStopOrders - New stop orders from the request.
   * @return Array of stop updates needed.
   */
  private calculateStopOrderChanges(
    currentStops: any[],
    newStopOrders: { stopId: string; newOrder: number }[],
  ): { stopId: string; newOrder: number }[] {
    const stopOrderMap = new Map(newStopOrders.map(so => [so.stopId, so.newOrder]));
    const changes: { stopId: string; newOrder: number }[] = [];

    for (const stop of currentStops) {
      const newOrder = stopOrderMap.get(stop.id);
      if (newOrder !== undefined && newOrder !== stop.order) {
        changes.push({ stopId: stop.id, newOrder });
      }
    }

    return changes;
  }

  /**
   * Identify which segments require updates based on stop reordering.
   * Only segments whose origin/destination stops have changed order need updates.
   * @param currentSegments - Current travel segments.
   * @param currentStops - Current stops.
   * @param newStopOrders - New stop orders.
   * @return Array of segments that need updates.
   */
  private identifySegmentsRequiringUpdates(
    currentSegments: any[],
    currentStops: any[],
    newStopOrders: { stopId: string; newOrder: number }[],
  ): any[] {
    // Create mapping of stop IDs to their new orders
    const stopOrderMap = new Map(newStopOrders.map(so => [so.stopId, so.newOrder]));
    
    // Create mapping of current stop IDs to their orders
    const currentStopOrderMap = new Map(currentStops.map(stop => [stop.id, stop.order]));

    // Build new stop ordering
    const newStopOrdering = [...currentStops].sort((a, b) => {
      const aNewOrder = stopOrderMap.get(a.id) ?? a.order;
      const bNewOrder = stopOrderMap.get(b.id) ?? b.order;
      return aNewOrder - bNewOrder;
    });

    // Identify segments that need updates
    const segmentsToUpdate: any[] = [];
    
    for (let i = 0; i < newStopOrdering.length - 1; i++) {
      const originStopId = newStopOrdering[i].id;
      const destinationStopId = newStopOrdering[i + 1].id;
      
      // Check if there's already a segment for this origin-destination pair
      const existingSegment = currentSegments.find(
        segment => segment.originStopId === originStopId && segment.destinationStopId === destinationStopId,
      );
      
      if (existingSegment) {
        // Segment exists and is correctly positioned - no update needed
        continue;
      } else {
        // Need to find the segment that should be updated for this position
        const segmentToUpdate = currentSegments.find(
          segment => 
            (segment.originStopId === originStopId || segment.destinationStopId === destinationStopId) &&
            !segmentsToUpdate.includes(segment),
        );
        
        if (segmentToUpdate) {
          segmentsToUpdate.push({
            ...segmentToUpdate,
            newOriginStopId: originStopId,
            newDestinationStopId: destinationStopId,
          });
        }
      }
    }

    return segmentsToUpdate;
  }

  /**
   * Generate routing updates for segments that need them.
   * @param segmentsRequiringUpdates - Segments that need updates.
   * @param currentStops - Current stops.
   * @param newStopOrders - New stop orders.
   * @return Routing data for segment updates.
   */
  private async generateSegmentRoutingUpdates(
    segmentsRequiringUpdates: any[],
    currentStops: any[],
    newStopOrders: { stopId: string; newOrder: number }[],
  ): Promise<any[]> {
    // For now, return basic update data - routing calculation would be added later
    return segmentsRequiringUpdates.map(segment => ({
      id: segment.id,
      originStopId: segment.newOriginStopId,
      destinationStopId: segment.newDestinationStopId,
      // Reset routing data to force recalculation
      apiCalculatedDistance: null,
      apiCalculatedDuration: null,
      polyline: null,
    }));
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
  ): Promise<any>[] {
    return stopOrderChanges.map(change =>
      prismaClient.stop.update({
        where: { id: change.stopId },
        data: { order: change.newOrder },
      }),
    );
  }

  /**
   * Prepare batched segment updates as PrismaPromise array.
   * @param segmentsRequiringUpdates - Segments that need updates.
   * @param currentStops - Current stops.
   * @param newStopOrders - New stop orders.
   * @param prismaClient - Prisma client for transaction.
   * @return Array of PrismaPromise for segment updates.
   */
  private async prepareBatchedSegmentUpdates(
    segmentsRequiringUpdates: any[],
    currentStops: any[],
    newStopOrders: { stopId: string; newOrder: number }[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Promise<any>[]> {
    const routingUpdates = await this.generateSegmentRoutingUpdates(
      segmentsRequiringUpdates,
      currentStops,
      newStopOrders,
    );

    return routingUpdates.map(update =>
      prismaClient.travelSegment.update({
        where: { id: update.id },
        data: {
          originStopId: update.originStopId,
          destinationStopId: update.destinationStopId,
          apiCalculatedDistance: update.apiCalculatedDistance,
          apiCalculatedDuration: update.apiCalculatedDuration,
          polyline: update.polyline,
        },
      }),
    );
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

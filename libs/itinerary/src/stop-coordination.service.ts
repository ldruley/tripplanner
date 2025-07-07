import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { TimelineService } from '@trip-planner/timeline';
import { RoutingCoordinationService } from './routing-coordination.service';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
  UpdateTripRoutingDto,
} from '@trip-planner/shared/dtos';
import {
  CreateLocationRequest,
  CreateStopRequest,
  Trip,
  TimelineCalculationRequest,
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
    private readonly timelineService: TimelineService,
    private readonly routingCoordinationService: RoutingCoordinationService,
  ) {}

  /**
   * Add a stop to a trip with all cascading effects.
   * Handles location creation, stop insertion, travel segment updates, and timeline recalculation.
   * @param userId - User ID who owns the trip.
   * @param data - Stop data to add.
   * @return The updated trip with all stops.
   */
  async addStopToTrip(userId: string, data: AddStopToTripDto): Promise<Trip> {
    this.logger.debug(`Adding stop to trip ${data.tripId} for user ${userId}`);

    return this.prismaService.$transaction(
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

        // Step 6: Recalculate timeline
        await this.recalculateAndUpdateTimeline(data.tripId, prismaClient);

        // Step 7: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          false,
          true,
          prismaClient,
        );

        this.logger.log(`Successfully added stop ${stop.id} to trip ${data.tripId}`);
        return completeTrip;
      },
    );
  }

  /**
   * Remove a stop from a trip with all cascading effects.
   * Handles stop removal, travel segment cleanup, and timeline recalculation.
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

        // Step 7: Recalculate timeline
        await this.recalculateAndUpdateTimeline(data.tripId, prismaClient);

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
   * Handles stop reordering, travel segment updates, and timeline recalculation.
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

        // Step 6: Recalculate timeline
        await this.recalculateAndUpdateTimeline(data.tripId, prismaClient);

        // Step 7: Return the complete trip
        const completeTrip = await this.tripService.findById(
          data.tripId,
          true,
          false,
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
   * Recreate travel segments after reordering with fresh routing data.
   * @param tripId - Trip ID.
   * @param prismaClient - Prisma client for transaction.
   */
  private async recreateTravelSegmentsAfterReorder(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get trip to determine travel mode
    const trip = await this.tripService.findById(tripId, false, false, false, prismaClient);

    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    // Get all stops to ensure we have at least 2 stops
    const stops = await this.stopService.findByTripId(tripId, false, prismaClient);

    if (stops.length < 2) {
      this.logger.debug(`Trip ${tripId} has fewer than 2 stops, skipping routing`);
      return;
    }

    // Create basic travel segments between consecutive stops first
    const stopIds = stops.map(stop => stop.id as string);
    await this.travelSegmentService.createSegmentsBetweenStops(tripId, stopIds, prismaClient);

    // Get fresh routing data for the entire trip with the new stop order
    await this.routingCoordinationService.updateTripRouting(
      {
        tripId: tripId,
        travelMode: 'DRIVING', //TODO: implement dynamic travel mode selection
        forceRecalculate: true, // Force fresh routing after stop changes
      },
      prismaClient,
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

  /**
   * Recalculate timeline and update database with results.
   * @param tripId - Trip ID to recalculate.
   * @param prismaClient - Prisma client for transaction.
   */
  private async recalculateAndUpdateTimeline(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get current trip data
    const trip = await this.tripService.findById(tripId, true, false, true, prismaClient);

    if (!trip.stops || trip.stops.length === 0) {
      this.logger.debug(`No stops found for trip ${tripId}, skipping timeline calculation`);
      return;
    }

    // Prepare timeline calculation request
    const timelineRequest: TimelineCalculationRequest = {
      stops: trip.stops,
      segments: trip.travelSegments || [],
      startTime: trip.startDate || undefined,
    };

    // Calculate timeline
    const result = this.timelineService.calculateSequentialTimeline(timelineRequest);

    // Update stops with calculated times
    for (const updatedStop of result.updatedStops) {
      await this.stopService.updateCalculatedTimes(
        updatedStop.id as string,
        updatedStop.calculatedArrivalTime ?? undefined,
        updatedStop.calculatedDepartureTime ?? undefined,
        prismaClient,
      );
    }

    this.logger.debug(
      `Updated timeline for trip ${tripId}: ${result.totalTripDuration} minutes total`,
    );
  }
}

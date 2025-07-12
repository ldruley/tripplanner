import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { TimelineService } from '@trip-planner/timeline';
import { CreateTripFromOrderedListDto } from '@trip-planner/shared/dtos';
import {
  Trip,
  CreateTripRequest,
  Stop,
  TravelSegment,
  LocationForItinerary,
  TimelineCalculationRequest,
  TimelineCalculationResult,
  SegmentRoutingData,
  ProcessedLocation,
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { StopService } from '@trip-planner/stop';
import { TripBankedLocationService } from './trip-banked-location.service';
import { RoutingCoordinationService } from './routing-coordination.service';

@Injectable()
export class BatchedTripCreationService {
  private readonly logger = new Logger(BatchedTripCreationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly routingCoordinationService: RoutingCoordinationService,
    private readonly timelineService: TimelineService,
    private readonly bankedLocationService: TripBankedLocationService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
  ) {}

  /**
   * EXPERIMENTAL: Create a complete trip using batched database operations.
   * This reduces database operations from 3N + 2M to ~5-8 operations total.
   * @param userId - User ID who owns the trip.
   * @param data - Trip data with organized locations.
   * @return The created trip with all stops, locations, and travel segments.
   */
  async createTripFromOrderedListBatched(
    userId: string,
    data: CreateTripFromOrderedListDto,
  ): Promise<Trip> {
    this.logger.debug(
      `[EXPERIMENTAL] Creating trip from organized list with batching for user ${userId}`,
    );

    // Validate organized locations have sequential order
    // TODO: can we just validate the request
    this.validateOrganizedLocations(data.organizedLocations);

    return await this.prismaService.$transaction(async prismaClient => {
      // Step 1: Create the trip (1 DB operation)
      const tripData: CreateTripRequest = {
        name: data.name,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      };

      const trip = await this.tripService.create(userId, tripData, prismaClient);
      this.logger.debug(`[EXPERIMENTAL] Created trip ${trip.id}`);

      // Step 2: Process all locations (organized + banked) with deduplication
      const allLocationData = this.preprocessAllLocations(
        data.organizedLocations,
        data.bankedLocations || [],
      );
      const createdLocations = await this.locationService.batchCreateLocations(
        allLocationData,
        prismaClient,
      );

      this.logger.debug(
        `[EXPERIMENTAL] Created/found ${Object.keys(createdLocations).length} locations via batched processing`,
      );

      // Step 3: Extract organized locations for stop creation
      const organizedLocationEntries = Object.entries(createdLocations).filter(([key]) =>
        key.startsWith('organized_'),
      );

      // Step 4: Batch create stops (1 DB operation)
      const stops = await this.stopService.batchCreateStops(
        trip.id as string,
        organizedLocationEntries,
        data.organizedLocations,
        prismaClient,
      );

      this.logger.debug(`[EXPERIMENTAL] Created ${stops.length} stops via batched operation`);

      // Step 5: Calculate routing data if requested
      let routingUpdates: SegmentRoutingData[] = [];
      if (data.calculateRouting && stops.length >= 2) {
        routingUpdates = await this.routingCoordinationService.calculateRoutingForAllSegments(
          stops,
          createdLocations,
          data.travelMode as TravelMode,
        );
        this.logger.debug(
          `[EXPERIMENTAL] Pre-calculated routing for ${routingUpdates.length} segments`,
        );
      }

      // Step 6: Batch create travel segments with routing data (1 DB operation)
      if (stops.length >= 2) {
        await this.travelSegmentService.batchCreateTravelSegments(
          trip.id as string,
          stops,
          routingUpdates,
          prismaClient,
        );
        this.logger.debug(
          `[EXPERIMENTAL] Created ${stops.length - 1} travel segments via batched operation`,
        );
      }

      // Step 7: Calculate and apply timeline data (includes arrival/departure times)
      if (stops.length >= 1) {
        await this.calculateAndApplyTimeline(
          trip.id as string,
          stops,
          routingUpdates,
          data.startDate ? new Date(data.startDate) : undefined,
          prismaClient,
        );
        this.logger.debug(
          `[EXPERIMENTAL] Calculated and applied timeline data for ${stops.length} stops`,
        );
      }

      // Step 8: Process banked locations if provided
      if (data.bankedLocations && data.bankedLocations.length > 0) {
        const bankedLocationEntries = Object.entries(createdLocations).filter(([key]) =>
          key.startsWith('banked_'),
        );
        await this.bankedLocationService.batchCreateBankRelations(
          userId,
          trip.id as string,
          bankedLocationEntries,
          prismaClient,
        );
        this.logger.debug(
          `[EXPERIMENTAL] Created ${bankedLocationEntries.length} bank relations via batched operation`,
        );
      }

      // Step 9: Set dirty flags based on routing calculation
      const needsRouting = !data.calculateRouting && stops.length >= 2;
      await this.tripService.updateTripDirtyFlags(
        trip.id as string,
        needsRouting,
        false,
        prismaClient,
      );

      // Step 10: Return the complete trip
      const completeTrip = await this.tripService.findById(
        trip.id as string,
        true,
        true,
        true,
        prismaClient,
      );

      this.logger.log(
        `[EXPERIMENTAL] Successfully created trip ${trip.id} with ${stops.length} stops using batched operations`,
      );
      return completeTrip;
    });
  }

  /**
   * TODO: Evaluate if we can remove organizedLocations as they are somewhat vestigial now.
   * Preprocess all locations (organized + banked) for batch operations.
   * PURE FUNCTION: No database calls, operates on input data.
   * @param organizedLocations - Organized locations for the itinerary.
   * @param bankedLocations - Banked locations for the trip.
   * @return Processed location data with indexing.
   */
  private preprocessAllLocations(
    organizedLocations: LocationForItinerary[],
    bankedLocations: LocationForItinerary[],
  ): ProcessedLocation[] {
    const processed: ProcessedLocation[] = [];

    // Process organized locations
    organizedLocations.forEach((location, index) => {
      processed.push({
        originalIndex: index,
        order: location.order,
        isBanked: false,
        locationData: {
          name: location.name,
          description: location.description,
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          postalCode: location.postalCode,
          latitude: location.latitude,
          longitude: location.longitude,
          apiSource: location.apiSource,
          apiSourceId: location.apiSourceId,
          category: location.category,
          public: false,
        },
      });
    });

    // Process banked locations
    bankedLocations.forEach((location, index) => {
      processed.push({
        originalIndex: index,
        isBanked: true,
        locationData: {
          name: location.name,
          description: location.description,
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          postalCode: location.postalCode,
          latitude: location.latitude,
          longitude: location.longitude,
          apiSource: location.apiSource,
          apiSourceId: location.apiSourceId,
          category: location.category,
          public: false,
        },
      });
    });

    return processed;
  }

  /**
   * Validate that organized locations have proper sequential ordering.
   * Reuses the same validation logic as the original service.
   * @param organizedLocations - List of organized locations to validate.
   */
  private validateOrganizedLocations(
    organizedLocations: {
      order: number;
      name: string;
      latitude: number;
      longitude: number;
    }[],
  ): void {
    if (organizedLocations.length === 0) {
      throw new BadRequestException('At least one location is required');
    }

    // Check for duplicate orders
    const orders = organizedLocations.map(loc => loc.order);
    const uniqueOrders = [...new Set(orders)];

    if (orders.length !== uniqueOrders.length) {
      throw new BadRequestException('Duplicate order values found in organized locations');
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

    // Validate required fields
    for (const location of organizedLocations) {
      if (!location.name || location.name.trim() === '') {
        throw new BadRequestException('All locations must have a name');
      }

      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new BadRequestException('All locations must have valid coordinates');
      }

      if (location.latitude < -90 || location.latitude > 90) {
        throw new BadRequestException('Latitude must be between -90 and 90');
      }

      if (location.longitude < -180 || location.longitude > 180) {
        throw new BadRequestException('Longitude must be between -180 and 180');
      }
    }
  }

  /**
   * Calculate timeline data and apply it to stops in a single batch operation.
   * This includes calculating arrival and departure times for all stops.
   * @param tripId - Trip ID for the timeline calculation.
   * @param stops - Created stops to calculate timeline for.
   * @param routingUpdates - Routing data containing travel durations.
   * @param startTime - Optional start time for the trip.
   * @param prismaClient - Prisma client for transaction.
   */
  private async calculateAndApplyTimeline(
    tripId: string,
    stops: Stop[],
    routingUpdates: SegmentRoutingData[],
    startTime: Date | undefined,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (stops.length === 0) {
      return;
    }

    // Create segments data structure needed for timeline calculation
    // Map routing data to segment-like objects for timeline service
    const segments: TravelSegment[] = routingUpdates.map(routingData => ({
      id: crypto.randomUUID(), // Generate valid UUID for timeline calculation
      tripId,
      originStopId: routingData.originStopId,
      destinationStopId: routingData.destinationStopId,
      travelMode: routingData.travelMode,
      distance: undefined,
      duration: undefined,
      apiCalculatedDistance: routingData.apiCalculatedDistance,
      apiCalculatedDuration: routingData.apiCalculatedDuration,
      polyline: routingData.polyline,
      routeOptions: undefined,
      notes: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Prepare timeline calculation request
    const timelineRequest: TimelineCalculationRequest = {
      stops: stops.map(stop => ({
        ...stop,
        // Ensure all required stop fields are present for timeline calculation
        plannedArrivalTime: undefined, // Let timeline service calculate
        plannedDuration: undefined, // Use defaults
        calculatedArrivalTime: undefined,
        calculatedDepartureTime: undefined,
        stopType: 'PITSTOP', // Default stop type
        notes: undefined,
        alias: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      segments,
      startTime,
    };

    // Calculate timeline using the pure timeline service
    const timelineResult: TimelineCalculationResult =
      this.timelineService.calculateSequentialTimeline(timelineRequest);

    // Extract calculated times and batch update all stops
    const stopTimeUpdates = timelineResult.updatedStops.map(updatedStop => ({
      stopId: updatedStop.id as string,
      calculatedArrivalTime: updatedStop.calculatedArrivalTime,
      calculatedDepartureTime: updatedStop.calculatedDepartureTime,
    }));

    // Batch update all stops with calculated timeline data
    const updateOperations = stopTimeUpdates.map(update =>
      prismaClient.stop.update({
        where: { id: update.stopId },
        data: {
          calculatedArrivalTime: update.calculatedArrivalTime,
          calculatedDepartureTime: update.calculatedDepartureTime,
        },
      }),
    );

    // Execute all timeline updates in parallel
    await Promise.all(updateOperations);

    this.logger.debug(
      `[EXPERIMENTAL] Applied timeline data to ${stopTimeUpdates.length} stops. Trip duration: ${timelineResult.totalTripDuration} minutes`,
    );
  }
}

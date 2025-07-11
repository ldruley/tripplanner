import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { RoutingService } from '@trip-planner/routing';
import { TimelineService } from '@trip-planner/timeline';
import { CreateTripFromOrganizedListDto } from '@trip-planner/shared/dtos';
import {
  Trip,
  CreateTripRequest,
  CreateLocationRequest,
  Location,
  Stop,
  TravelSegment,
  RoutingRequestSchema,
  RoutingResponse,
  LocationForItinerary,
  TimelineCalculationRequest,
  TimelineCalculationResult,
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

interface ProcessedLocation {
  originalIndex: number;
  locationData: CreateLocationRequest;
  order?: number; // Only for organized locations
  isBanked: boolean;
}

interface CreatedLocationMap {
  [key: string]: Location; // Key is the location index or identifier
}

@Injectable()
export class BatchedTripCreationService {
  private readonly logger = new Logger(BatchedTripCreationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly routingService: RoutingService,
    private readonly timelineService: TimelineService,
  ) {}

  /**
   * EXPERIMENTAL: Create a complete trip using batched database operations.
   * This reduces database operations from 3N + 2M to ~5-8 operations total.
   * @param userId - User ID who owns the trip.
   * @param data - Trip data with organized locations.
   * @return The created trip with all stops, locations, and travel segments.
   */
  async createTripFromOrganizedListBatched(
    userId: string,
    data: CreateTripFromOrganizedListDto,
  ): Promise<Trip> {
    this.logger.debug(
      `[EXPERIMENTAL] Creating trip from organized list with batching for user ${userId}`,
    );

    // Validate organized locations have sequential order
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
      const allLocationData = this.preprocessAllLocations(data.organizedLocations, data.bankedLocations || []);
      const createdLocations = await this.batchCreateLocations(allLocationData, prismaClient);
      
      this.logger.debug(
        `[EXPERIMENTAL] Created/found ${Object.keys(createdLocations).length} locations via batched processing`,
      );

      // Step 3: Extract organized locations for stop creation
      const organizedLocationEntries = Object.entries(createdLocations).filter(([key]) => 
        key.startsWith('organized_')
      );

      // Step 4: Batch create stops (1 DB operation)
      const stops = await this.batchCreateStops(
        trip.id as string,
        organizedLocationEntries,
        data.organizedLocations,
        prismaClient,
      );

      this.logger.debug(`[EXPERIMENTAL] Created ${stops.length} stops via batched operation`);

      // Step 5: Calculate routing data if requested
      let routingUpdates: SegmentRoutingData[] = [];
      if (data.calculateRouting && stops.length >= 2) {
        routingUpdates = await this.calculateRoutingForAllSegments(
          stops,
          createdLocations,
          data.travelMode as TravelMode,
        );
        this.logger.debug(`[EXPERIMENTAL] Pre-calculated routing for ${routingUpdates.length} segments`);
      }

      // Step 6: Batch create travel segments with routing data (1 DB operation)
      if (stops.length >= 2) {
        await this.batchCreateTravelSegments(trip.id as string, stops, routingUpdates, prismaClient);
        this.logger.debug(`[EXPERIMENTAL] Created ${stops.length - 1} travel segments via batched operation`);
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
        this.logger.debug(`[EXPERIMENTAL] Calculated and applied timeline data for ${stops.length} stops`);
      }

      // Step 8: Process banked locations if provided
      if (data.bankedLocations && data.bankedLocations.length > 0) {
        const bankedLocationEntries = Object.entries(createdLocations).filter(([key]) => 
          key.startsWith('banked_')
        );
        await this.batchCreateBankRelations(
          userId,
          trip.id as string,
          bankedLocationEntries,
          prismaClient,
        );
        this.logger.debug(`[EXPERIMENTAL] Created ${bankedLocationEntries.length} bank relations via batched operation`);
      }

      // Step 9: Set dirty flags based on routing calculation
      const needsRouting = !data.calculateRouting && stops.length >= 2;
      await this.tripService.updateTripDirtyFlags(trip.id as string, needsRouting, false, prismaClient);

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
   * Batch create/find all locations with deduplication logic.
   * Reduces 2N + 2M location operations to 1-2 operations.
   * @param allLocationData - All processed location data.
   * @param prismaClient - Prisma client for transaction.
   * @return Map of created/found locations indexed by their type and original index.
   */
  private async batchCreateLocations(
    allLocationData: ProcessedLocation[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<CreatedLocationMap> {
    const createdLocations: CreatedLocationMap = {};

    // For now, we'll process locations sequentially to maintain deduplication logic
    // TODO: Implement true bulk deduplication in a future optimization
    for (const processedLocation of allLocationData) {
      const location = await this.locationService.create(
        processedLocation.locationData,
        { enableExactCoordinateMatching: true, enableApiSourceMatching: true },
        prismaClient,
      );

      const key = processedLocation.isBanked 
        ? `banked_${processedLocation.originalIndex}` 
        : `organized_${processedLocation.originalIndex}`;
      
      createdLocations[key] = location;
    }

    return createdLocations;
  }

  /**
   * Batch create all stops in a single database operation.
   * Reduces N stop operations to 1 operation.
   * @param tripId - Trip ID for the stops.
   * @param organizedLocationEntries - Organized location entries with keys.
   * @param originalOrganizedLocations - Original organized location data.
   * @param prismaClient - Prisma client for transaction.
   * @return Array of created stops.
   */
  private async batchCreateStops(
    tripId: string,
    organizedLocationEntries: [string, Location][],
    originalOrganizedLocations: LocationForItinerary[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    // Build stop creation data
    const stopCreateData = organizedLocationEntries.map(([key, location]) => {
      const originalIndex = parseInt(key.split('_')[1]);
      const originalLocation = originalOrganizedLocations[originalIndex];
      
      return {
        tripId,
        locationId: location.id as string,
        order: originalLocation.order,
        plannedArrivalTime: null,
        plannedDuration: null,
        stopType: 'PITSTOP' as const,
        notes: null,
        alias: null,
      };
    });

    // Sort by order to ensure correct creation sequence
    stopCreateData.sort((a, b) => a.order - b.order);

    // Batch create all stops
    const createdStops = await prismaClient.stop.createManyAndReturn({
      data: stopCreateData,
    });

    return createdStops;
  }

  /**
   * Calculate routing data for all consecutive stop pairs.
   * Makes external API calls to routing service for all segments.
   * @param stops - Created stops in order.
   * @param createdLocations - Map of created locations.
   * @param travelMode - Travel mode for routing.
   * @return Routing data for all segments.
   */
  private async calculateRoutingForAllSegments(
    stops: Stop[],
    createdLocations: CreatedLocationMap,
    travelMode: TravelMode,
  ): Promise<SegmentRoutingData[]> {
    if (stops.length < 2) {
      return [];
    }

    const routingUpdates: SegmentRoutingData[] = [];

    // Sort stops by order to ensure correct sequence
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originStop = sortedStops[i];
      const destinationStop = sortedStops[i + 1];

      // Find the location data for routing
      const originLocation = Object.values(createdLocations).find(
        loc => loc.id === originStop.locationId
      );
      const destinationLocation = Object.values(createdLocations).find(
        loc => loc.id === destinationStop.locationId
      );

      if (!originLocation || !destinationLocation) {
        this.logger.warn(
          `Missing location data for segment ${originStop.id}-${destinationStop.id}`,
        );
        continue;
      }

      try {
        // Create waypoints for routing request
        const waypoints = [
          {
            latitude: originLocation.latitude,
            longitude: originLocation.longitude,
            name: originLocation.name,
          },
          {
            latitude: destinationLocation.latitude,
            longitude: destinationLocation.longitude,
            name: destinationLocation.name,
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
          `Pre-calculated routing for segment ${originStop.id}-${destinationStop.id} using ${routingResult.provider}: ${routingResult.route.distance}m, ${routingResult.route.duration}s`,
        );

        // Map routing result to segment creation format
        const routingData: SegmentRoutingData = {
          originStopId: originStop.id as string,
          destinationStopId: destinationStop.id as string,
          travelMode: travelMode,
          apiCalculatedDistance: routingResult.route.distance,
          apiCalculatedDuration: Math.round(routingResult.route.duration / 60), // Convert seconds to minutes
          polyline: routingResult.route.geometry,
        };

        routingUpdates.push(routingData);
      } catch (error) {
        this.logger.error(
          `Failed to calculate routing for segment ${originStop.id}-${destinationStop.id}: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Fallback: create segment without routing data
        const routingData: SegmentRoutingData = {
          originStopId: originStop.id as string,
          destinationStopId: destinationStop.id as string,
          travelMode: travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        };

        routingUpdates.push(routingData);
      }
    }

    return routingUpdates;
  }

  /**
   * Batch create travel segments with pre-calculated routing data.
   * Reduces N-1 segment operations to 1 operation.
   * @param tripId - Trip ID for the segments.
   * @param stops - Created stops in order.
   * @param routingUpdates - Pre-calculated routing data (empty if calculateRouting=false).
   * @param prismaClient - Prisma client for transaction.
   */
  private async batchCreateTravelSegments(
    tripId: string,
    stops: Stop[],
    routingUpdates: SegmentRoutingData[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (stops.length < 2) {
      return;
    }

    // Create routing map for efficient lookups
    const routingMap = new Map(
      routingUpdates.map(r => [`${r.originStopId}-${r.destinationStopId}`, r])
    );

    // Sort stops by order to ensure correct sequence
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    // Build segment creation data
    const segmentCreateData = [];
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originStop = sortedStops[i];
      const destinationStop = sortedStops[i + 1];
      const segmentKey = `${originStop.id}-${destinationStop.id}`;
      const routingData = routingMap.get(segmentKey);

      const segmentData = {
        tripId,
        originStopId: originStop.id as string,
        destinationStopId: destinationStop.id as string,
        travelMode: routingData?.travelMode || undefined,
        distance: undefined, // User can set this manually later
        duration: undefined, // User can set this manually later
        apiCalculatedDistance: routingData?.apiCalculatedDistance || undefined,
        apiCalculatedDuration: routingData?.apiCalculatedDuration || undefined,
        polyline: routingData?.polyline || undefined,
        routeOptions: undefined,
        notes: undefined,
      };

      segmentCreateData.push(segmentData);
    }

    // Batch create all segments
    await prismaClient.travelSegment.createMany({
      data: segmentCreateData,
    });
  }

  /**
   * Batch create bank relations for banked locations.
   * Reduces M bank operations to 1 operation.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID for the bank relations.
   * @param bankedLocationEntries - Banked location entries with keys.
   * @param prismaClient - Prisma client for transaction.
   */
  private async batchCreateBankRelations(
    userId: string,
    tripId: string,
    bankedLocationEntries: [string, Location][],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (bankedLocationEntries.length === 0) {
      return;
    }

    // Build bank relation creation data
    const bankCreateData = bankedLocationEntries.map(([key, location]) => ({
      tripId,
      locationId: location.id as string,
    }));

    // Batch create all bank relations
    await prismaClient.tripBankedLocation.createMany({
      data: bankCreateData,
    });
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
    const timelineResult: TimelineCalculationResult = this.timelineService.calculateSequentialTimeline(timelineRequest);

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
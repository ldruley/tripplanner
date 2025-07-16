import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { TimelineService } from '@trip-planner/timeline';
import { CreateTripFromOrderedListDto } from '@trip-planner/shared/dtos';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';
import {
  Trip,
  CreateTripRequest,
  Stop,
  TravelSegment,
  TimelineCalculationRequest,
  TimelineCalculationResult,
  SegmentRoutingData,
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { StopService } from '@trip-planner/stop';
import { TripBankedLocationService } from './tripbankedlocation/trip-banked-location.service';
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
    private readonly sharedValidationService: SharedValidationService,
    private readonly sharedLocationProcessingService: SharedLocationProcessingService,
  ) {}

  /**
   * REFACTORED BATCHING: Create a complete trip using batched database operations.
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
      `[REFACTORED BATCHING] Creating trip from organized list with batching for user ${userId}`,
    );

    // Step 1: Validate the request
    this.validateTripCreationRequest(data);

    return await this.prismaService.$transaction(async prismaClient => {
      // Step 2: Create the base trip
      const trip = await this.createBaseTripEntity(userId, data, prismaClient);

      // Step 3: Process and create all locations
      const createdLocations = await this.processAndCreateLocations(data, prismaClient);

      // Step 4: Create stops from organized locations
      const stops = await this.createStopsFromOrganizedLocations(
        trip.id as string,
        data,
        createdLocations,
        prismaClient,
      );

      // Step 5: Calculate routing if requested
      const routingUpdates = await this.calculateRoutingIfRequested(
        data,
        stops,
        createdLocations,
      );

      // Step 6: Create travel segments with routing data
      await this.createTravelSegmentsWithRouting(
        trip.id as string,
        stops,
        routingUpdates,
        prismaClient,
      );

      // Step 7: Calculate and apply timeline
      await this.calculateAndApplyTimelineForStops(
        trip.id as string,
        stops,
        routingUpdates,
        data.startDate,
        prismaClient,
      );

      // Step 8: Process banked locations
      await this.processBankedLocations(
        userId,
        trip.id as string,
        data,
        createdLocations,
        prismaClient,
      );

      // Step 9: Set appropriate dirty flags
      await this.setTripDirtyFlags(trip.id as string, data, stops.length, prismaClient);

      // Step 10: Return complete trip
      return await this.loadCompleteTrip(trip.id as string, prismaClient);
    });
  }

  /**
   * Validate trip creation request for completeness and consistency.
   */
  private validateTripCreationRequest(data: CreateTripFromOrderedListDto): void {
    this.sharedValidationService.validateOrganizedLocations(data.organizedLocations);

    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Trip name is required');
    }

    if (data.organizedLocations.length === 0) {
      throw new Error('At least one organized location is required');
    }
  }

  /**
   * Create the base trip entity.
   */
  private async createBaseTripEntity(
    userId: string,
    data: CreateTripFromOrderedListDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    const tripData: CreateTripRequest = {
      name: data.name,
      description: data.description,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      matrix: data.matrix,
    };

    const createdTrip = await this.tripService.create(userId, tripData, prismaClient);
    this.logger.debug(`[REFACTORED BATCHING] Created trip ${createdTrip.id}`);
    
    // Fetch the complete trip with all relations
    const trip = await this.tripService.findById(createdTrip.id!, true, true, true, prismaClient);
    if (!trip) {
      throw new Error(`Failed to fetch created trip ${createdTrip.id}`);
    }
    
    return trip;
  }

  /**
   * Process and create all locations (organized + banked) with deduplication.
   */
  private async processAndCreateLocations(
    data: CreateTripFromOrderedListDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Record<string, any>> {
    const allLocationData = this.sharedLocationProcessingService.preprocessAllLocations(
      data.organizedLocations,
      data.bankedLocations || [],
    );
    
    const createdLocations = await this.sharedLocationProcessingService.batchProcessLocations(
      allLocationData,
      prismaClient,
    );

    this.logger.debug(
      `[REFACTORED BATCHING] Created/found ${Object.keys(createdLocations).length} locations via batched processing`,
    );
    
    return createdLocations;
  }

  /**
   * Create stops from organized locations.
   */
  private async createStopsFromOrganizedLocations(
    tripId: string,
    data: CreateTripFromOrderedListDto,
    createdLocations: Record<string, any>,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    const organizedLocationEntries = Object.entries(createdLocations).filter(([key]) =>
      key.startsWith('organized_'),
    );

    const stops = await this.stopService.batchCreateStops(
      tripId,
      organizedLocationEntries,
      data.organizedLocations,
      prismaClient,
    );

    this.logger.debug(`[REFACTORED BATCHING] Created ${stops.length} stops via batched operation`);
    return stops;
  }

  /**
   * Calculate routing data if requested.
   */
  private async calculateRoutingIfRequested(
    data: CreateTripFromOrderedListDto,
    stops: Stop[],
    createdLocations: Record<string, any>,
  ): Promise<SegmentRoutingData[]> {
    if (!data.calculateRouting || stops.length < 2) {
      return [];
    }

    const routingUpdates = await this.routingCoordinationService.calculateRoutingForAllSegments(
      stops,
      createdLocations,
      data.travelMode as TravelMode,
    );
    
    this.logger.debug(
      `[REFACTORED BATCHING] Pre-calculated routing for ${routingUpdates.length} segments`,
    );
    
    return routingUpdates;
  }

  /**
   * Create travel segments with routing data.
   */
  private async createTravelSegmentsWithRouting(
    tripId: string,
    stops: Stop[],
    routingUpdates: SegmentRoutingData[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (stops.length < 2) {
      return;
    }

    await this.travelSegmentService.batchCreateTravelSegments(
      tripId,
      stops,
      routingUpdates,
      prismaClient,
    );
    
    this.logger.debug(
      `[REFACTORED BATCHING] Created ${stops.length - 1} travel segments via batched operation`,
    );
  }

  /**
   * Calculate and apply timeline data for all stops.
   */
  private async calculateAndApplyTimelineForStops(
    tripId: string,
    stops: Stop[],
    routingUpdates: SegmentRoutingData[],
    startDate: string | undefined,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (stops.length === 0) {
      return;
    }

    const startTime = startDate ? new Date(startDate) : undefined;
    await this.calculateAndApplyTimeline(tripId, stops, routingUpdates, startTime, prismaClient);
    
    this.logger.debug(
      `[REFACTORED BATCHING] Calculated and applied timeline data for ${stops.length} stops`,
    );
  }

  /**
   * Process banked locations if provided.
   */
  private async processBankedLocations(
    userId: string,
    tripId: string,
    data: CreateTripFromOrderedListDto,
    createdLocations: Record<string, any>,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (!data.bankedLocations || data.bankedLocations.length === 0) {
      return;
    }

    const bankedLocationEntries = Object.entries(createdLocations).filter(([key]) =>
      key.startsWith('banked_'),
    );
    
    await this.bankedLocationService.batchCreateBankRelations(
      userId,
      tripId,
      bankedLocationEntries,
      prismaClient,
    );
    
    this.logger.debug(
      `[REFACTORED BATCHING] Created ${bankedLocationEntries.length} bank relations via batched operation`,
    );
  }

  /**
   * Set appropriate dirty flags based on routing calculation.
   */
  private async setTripDirtyFlags(
    tripId: string,
    data: CreateTripFromOrderedListDto,
    stopCount: number,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    const needsRouting = !data.calculateRouting && stopCount >= 2;
    await this.tripService.updateTripDirtyFlags(tripId, needsRouting, false, prismaClient);
  }

  /**
   * Load and return the complete trip with all relations.
   */
  private async loadCompleteTrip(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    const completeTrip = await this.tripService.findById(tripId, true, true, true, prismaClient);
    
    this.logger.log(
      `[REFACTORED BATCHING] Successfully created trip ${tripId} with ${completeTrip.stops?.length || 0} stops using batched operations`,
    );
    
    return completeTrip;
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
        plannedArrivalTime: undefined,
        plannedDuration: undefined,
        calculatedArrivalTime: undefined,
        calculatedDepartureTime: undefined,
        stopType: 'PITSTOP',
        notes: undefined,
        alias: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      segments,
      startTime,
    };

    // Calculate timeline using the timeline service
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

    await Promise.all(updateOperations);

    this.logger.debug(
      `Applied timeline data to ${stopTimeUpdates.length} stops. Trip duration: ${timelineResult.totalTripDuration} minutes`,
    );
  }
}

import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { TimelineService } from '@trip-planner/timeline';
import { CreateTripFromOrderedListDto, AddStopToTripDto, RemoveStopFromTripDto, ItineraryReorderStopsDto, UpdateTripRoutingDto, UpdateTripWithRoutingDto } from '@trip-planner/shared/dtos';
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
  UpdateTripWithRoutingSchema,
  TripFindOptions,
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { StopService } from '@trip-planner/stop';
import { TripBankedLocationService } from './tripbankedlocation/trip-banked-location.service';

import { RoutingIntegrationService } from './routing-integration.service';
import { SegmentPlanningService } from './segment-planning.service';
import { StopCoordinationService } from './stop-coordination.service';
import { TimelineCoordinationService } from './timeline-coordination.service';

@Injectable()
export class ItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    
    private readonly routingIntegrationService: RoutingIntegrationService,
    private readonly segmentPlanningService: SegmentPlanningService,
    private readonly timelineService: TimelineService,
    private readonly bankedLocationService: TripBankedLocationService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
    private readonly sharedValidationService: SharedValidationService,
    private readonly sharedLocationProcessingService: SharedLocationProcessingService,
    private readonly stopCoordinationService: StopCoordinationService,
    private readonly timelineCoordinationService: TimelineCoordinationService,
    private readonly bankCoordinationService: TripBankedLocationService,
  ) {}

  async createTripFromOrganizedListBatched(
    userId: string,
    data: CreateTripFromOrderedListDto,
  ): Promise<Trip> {
    this.logger.debug(
      `[REFACTORED BATCHING] Creating trip from organized list with batching for user ${userId}`,
    );

    // Step 1: Validate the request
    this.sharedValidationService.validateTripCreationRequest(data);

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

      // Step 5: Enrich stops with location data for routing calculations
      const stopsWithLocations = await this.enrichStopsWithLocationData(stops, createdLocations);

      // Step 6: Calculate routing if requested
      const routingUpdates = await this.calculateRoutingIfRequested(
        data,
        stopsWithLocations,
        createdLocations,
      );

      // Step 7: Create travel segments with routing data
      await this.createTravelSegmentsWithRouting(
        trip.id as string,
        stopsWithLocations,
        routingUpdates,
        prismaClient,
      );

      // Step 8: Calculate and apply timeline
      await this.calculateAndApplyTimelineForStops(
        trip.id as string,
        stopsWithLocations,
        routingUpdates,
        data.startDate,
        prismaClient,
      );

      // Step 9: Process banked locations
      await this.processBankedLocations(
        userId,
        trip.id as string,
        data,
        createdLocations,
        prismaClient,
      );

      // Step 10: Set appropriate dirty flags
      await this.setTripDirtyFlags(trip.id as string, data, stopsWithLocations.length, prismaClient);

      // Step 11: Return complete trip
      return await this.loadCompleteTrip(trip.id as string, prismaClient);
    });
  }

  

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
    const fullOptions: TripFindOptions = { includeStops: true, includeBankedLocations: true, includeTravelSegments: true };
    const trip = await this.tripService.findById(createdTrip.id!, fullOptions, prismaClient);
    if (!trip) {
      throw new Error(`Failed to fetch created trip ${createdTrip.id}`);
    }
    
    return trip;
  }

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

  private async calculateRoutingIfRequested(
    data: CreateTripFromOrderedListDto,
    stops: Stop[],
    createdLocations: Record<string, any>,
  ): Promise<SegmentRoutingData[]> {
    if (!data.calculateRouting || stops.length < 2) {
      return [];
    }

    // Parse matrix if it's a string, otherwise use as-is
    const parsedMatrix = typeof data.matrix === 'string' 
      ? JSON.parse(data.matrix) 
      : data.matrix;

    // Use the new matrix-first routing integration service instead of direct API routing
    // Create a temporary trip object for routing calculations
    const tempTrip = {
      id: 'temp-trip-for-routing',
      matrix: parsedMatrix,
    } as Trip;

    // Create segment pairs from consecutive stops for routing calculation
    const basicSegmentPairs = this.createSegmentPairsFromStops(stops);
    
    // Convert to full SegmentPair format with tripId
    const segmentPairs = basicSegmentPairs.map(pair => ({
      tripId: tempTrip.id,
      originStopId: pair.originStopId,
      destinationStopId: pair.destinationStopId,
    }));

    // Get matrix-first routing strategy
    const routingStrategy = this.routingIntegrationService.getOptimalStrategy(
      segmentPairs.length,
      !!parsedMatrix,
      true, // preferSpeed: true for matrix-first timing calculations
      data.calculateRouting || false, // requireAccuracy only when polylines/detailed routing needed
    );

    // Acquire routing data using matrix-first strategy
    const routingResult = await this.routingIntegrationService.acquireRoutingData({
      segmentPairs,
      stops,
      trip: tempTrip,
      strategy: routingStrategy,
      travelMode: data.travelMode as TravelMode,
      matrix: parsedMatrix,
    });
    
    this.logger.debug(
      `[REFACTORED BATCHING] Pre-calculated routing for ${routingResult.routingData.length} segments using ${routingResult.source} source`,
    );
    
    return routingResult.routingData;
  }

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

  private async setTripDirtyFlags(
    tripId: string,
    data: CreateTripFromOrderedListDto,
    stopCount: number,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    // Set needsRoutingRecalculation in these cases:
    // 1. Routing was not calculated at all (!data.calculateRouting)
    // 2. Matrix routing was used (data.matrix exists) which doesn't generate polylines for visualization
    const hasMatrix = data.matrix && (typeof data.matrix === 'string' ? JSON.parse(data.matrix) : data.matrix);
    const usedMatrixRouting = data.calculateRouting && hasMatrix;
    const needsRouting = (!data.calculateRouting || usedMatrixRouting) && stopCount >= 2;
    
    this.logger.debug(
      `Setting trip dirty flags: calculateRouting=${data.calculateRouting}, hasMatrix=${!!hasMatrix}, ` +
      `usedMatrixRouting=${usedMatrixRouting}, needsRouting=${needsRouting}`
    );
    
    await this.tripService.updateTripDirtyFlags(tripId, needsRouting, false, prismaClient);
  }

  private async loadCompleteTrip(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Trip> {
    const fullOptions: TripFindOptions = { includeStops: true, includeBankedLocations: true, includeTravelSegments: true };
    const completeTrip = await this.tripService.findById(tripId, fullOptions, prismaClient);
    
    this.logger.log(
      `[REFACTORED BATCHING] Successfully created trip ${tripId} with ${completeTrip.stops?.length || 0} stops using batched operations`,
    );
    
    return completeTrip;
  }

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
      id: randomUUID(), // Generate valid UUID for timeline calculation
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

  private async enrichStopsWithLocationData(
    stops: Stop[],
    createdLocations: Record<string, any>,
  ): Promise<Stop[]> {
    return stops.map(stop => {
      // Find the location data for this stop's locationId
      const location = Object.values(createdLocations).find(
        (loc: any) => loc.id === stop.locationId
      );

      if (!location) {
        this.logger.error(
          `Missing location data for stop ${stop.id} with locationId ${stop.locationId}`
        );
        throw new Error(`Location data not found for stop ${stop.id}`);
      }

      // Return stop with location relation populated
      return {
        ...stop,
        location: {
          id: location.id,
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          timezone: location.timezone,
          createdAt: location.createdAt || new Date(),
          updatedAt: location.updatedAt || new Date(),
          // Include other location fields as needed
        },
      } as Stop;
    });
  }

  private createSegmentPairsFromStops(stops: Stop[]): { originStopId: string; destinationStopId: string }[] {
    if (stops.length < 2) {
      return [];
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const segmentPairs = [];

    for (let i = 0; i < sortedStops.length - 1; i++) {
      segmentPairs.push({
        originStopId: sortedStops[i].id as string,
        destinationStopId: sortedStops[i + 1].id as string,
      });
    }

    return segmentPairs;
  }

  async addStopToTripWithBatching(userId: string, data: AddStopToTripDto): Promise<Trip> {
    this.logger.log(
      `[TRUE BATCHING] Adding stop to trip with comprehensive batching ${data.tripId} for user ${userId}`,
    );

    // Validate trip ownership and grab full trip data
    const trip = await this.sharedValidationService.validateTripAndOwnership(data.tripId, userId);
    try {
      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          // Single operation: add stop with complete pre-calculation and atomic updates
          // This includes: location creation, stop insertion, order adjustments, routing calculation,
          // timeline calculation, and all database updates in a single coordinated batch
          const updatedTrip = await this.stopCoordinationService.addStopToTripWithBatching(
            trip,
            data,
            prismaClient,
          );

          this.logger.log(
            `[TRUE BATCHING] Successfully added stop to trip ${data.tripId} with complete batching`,
          );
          return updatedTrip;
        },
      );
    } catch (error) {
      this.logger.error(
        `[TRUE BATCHING] Failed to add stop with batching to trip ${data.tripId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  

  async removeStopFromTripWithBatching(userId: string, data: RemoveStopFromTripDto): Promise<Trip> {
    this.logger.log(
      `[TRUE BATCHING] Removing stop from trip with comprehensive batching ${data.tripId} for user ${userId}`,
    );

    // Validate trip ownership and grab full trip data
    const trip = await this.sharedValidationService.validateTripAndOwnership(data.tripId, userId);

    try {
      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          // Single operation: remove stop with complete pre-calculation and atomic updates
          // This includes: stop deletion, order adjustments, routing calculation,
          // timeline calculation, and all database updates in a single coordinated batch
          const updatedTrip = await this.stopCoordinationService.removeStopFromTripWithBatching(
            trip,
            data,
            prismaClient,
          );

          this.logger.log(
            `[TRUE BATCHING] Successfully removed stop from trip ${data.tripId} with complete batching`,
          );
          return updatedTrip;
        },
      );
    } catch (error) {
      this.logger.error(
        `[TRUE BATCHING] Failed to remove stop with batching from trip ${data.tripId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async reorderStopsWithBatching(userId: string, data: ItineraryReorderStopsDto): Promise<Trip> {
    this.logger.log(
      `[TRUE BATCHING] Reordering stops with comprehensive batching in trip ${data.tripId} for user ${userId}`,
    );

    try {
      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          // Single operation: reorder stops with complete pre-calculation and atomic updates
          // This includes: stop order changes, routing calculation, timeline calculation,
          // and all database updates in a single coordinated batch
          const trip = await this.stopCoordinationService.reorderStopsWithBatching(
            userId,
            data,
            prismaClient,
          );

          this.logger.log(
            `[TRUE BATCHING] Successfully reordered stops in trip ${data.tripId} with complete batching`,
          );
          return trip;
        },
      );
    } catch (error) {
      this.logger.error(
        `[TRUE BATCHING] Failed to reorder stops with batching in trip ${data.tripId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async updateTripRouting(userId: string, data: UpdateTripRoutingDto): Promise<Trip> {
    this.logger.log(`Updating routing for trip ${data.tripId} for user ${userId}`);

    try {
      // Note: We should validate trip ownership here, but for now we'll trust the routing service
      const trip = await this.routingIntegrationService.updateTripRouting(data);

      this.logger.log(`Successfully updated routing for trip ${data.tripId}`);
      return trip;
    } catch (error) {
      this.logger.error(
        `Failed to update routing for trip ${data.tripId} for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async getTripRoutingSummary(tripId: string): Promise<{
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    hasCompleteRouting: boolean;
    segmentCount: number;
  }> {
    this.logger.debug(`Getting routing summary for trip ${tripId}`);

    try {
      const summary = await this.routingIntegrationService.getTripRoutingSummary(tripId);

      this.logger.debug(
        `Retrieved routing summary for trip ${tripId}: ${summary.segmentCount} segments`,
      );
      return summary;
    } catch (error) {
      this.logger.error(`Failed to get routing summary for trip ${tripId}:`, error);
      throw error;
    }
  }

  async isRoutingNeeded(tripId: string, forceRecalculate = false): Promise<boolean> {
    this.logger.debug(`Checking if routing is needed for trip ${tripId}`);

    try {
      const needed = await this.routingIntegrationService.isRoutingNeeded(
        tripId,
        forceRecalculate,
      );

      this.logger.debug(`Routing needed for trip ${tripId}: ${needed}`);
      return needed;
    } catch (error) {
      this.logger.error(`Failed to check routing status for trip ${tripId}:`, error);
      throw error;
    }
  }

  async calculateRoutingIfNeeded(
    tripId: string,
    travelMode: TravelMode = TravelMode.DRIVING,
    forceRecalculate = false,
  ): Promise<Trip | null> {
    this.logger.debug(`Calculating routing if needed for trip ${tripId}`);

    try {
      const routingNeeded = await this.isRoutingNeeded(tripId, forceRecalculate);

      if (!routingNeeded) {
        this.logger.debug(`Routing not needed for trip ${tripId}`);
        return null;
      }

      const routingData: UpdateTripRoutingDto = {
        tripId,
        travelMode,
        forceRecalculate,
      };

      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          const trip = await this.routingIntegrationService.updateTripRouting(
            routingData,
            prismaClient,
          );

          // Calculate timeline after routing
          await this.timelineCoordinationService.recalculateAndUpdateTimeline(tripId, prismaClient);

          this.logger.log(`Successfully calculated routing and timeline for trip ${tripId}`);
          return trip;
        },
      );
    } catch (error) {
      this.logger.error(`Failed to calculate routing for trip ${tripId}:`, error);
      throw error;
    }
  }

  async updateTripWithRouting(
    userId: string,
    tripId: string,
    data: UpdateTripWithRoutingDto,
  ): Promise<Trip> {
    this.logger.log(`Updating trip ${tripId} with routing for user ${userId}`);
    const parsedData = UpdateTripWithRoutingSchema.parse(data);
    try {
      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          // Step 1: Update trip basic information
          const updateData = {
            name: parsedData.name,
            description: parsedData.description,
            startDate: parsedData.startDate,
            endDate: parsedData.endDate,
          };

          await this.tripService.update(tripId, updateData, prismaClient);

          // Step 2: Get the updated trip with complete data structure
          const fullOptions: TripFindOptions = { includeStops: true, includeBankedLocations: true, includeTravelSegments: true };
          const tripWithStops = await this.tripService.findById(
            tripId,
            fullOptions,
            prismaClient,
          );

          // Step 3: Calculate routing if requested and there are enough stops
          if (data.calculateRouting && tripWithStops.stops && tripWithStops.stops.length > 1) {
            this.logger.debug(`Calculating routing after updating trip ${tripId}`);

            const routingData: UpdateTripRoutingDto = {
              tripId,
              travelMode: data.travelMode,
              forceRecalculate: data.forceRecalculate,
            };

            const tripWithRouting = await this.routingIntegrationService.updateTripRouting(
              routingData,
              prismaClient,
            );

            // Step 4: Calculate timeline after routing
            await this.timelineCoordinationService.recalculateAndUpdateTimeline(
              tripId,
              prismaClient,
            );

            this.logger.log(`Successfully updated trip ${tripId} with routing and timeline`);
            return tripWithRouting;
          }

          this.logger.log(`Successfully updated trip ${tripId} without routing`);
          return tripWithStops;
        },
      );
    } catch (error) {
      this.logger.error(`Failed to update trip ${tripId} with routing for user ${userId}:`, error);
      throw error;
    }
  }

  async addLocationToBank(userId: string, tripId: string, locationId: string): Promise<any> {
    this.logger.log(`Adding location ${locationId} to bank for trip ${tripId} for user ${userId}`);

    try {
      const bankedLocation = await this.bankCoordinationService.addLocationToBank(
        userId,
        tripId,
        locationId,
      );

      this.logger.log(`Successfully added location ${locationId} to bank for trip ${tripId}`);
      return bankedLocation;
    } catch (error) {
      this.logger.error(`Failed to add location ${locationId} to bank for trip ${tripId}:`, error);
      throw error;
    }
  }

  async removeLocationFromBank(userId: string, tripId: string, locationId: string): Promise<void> {
    this.logger.log(
      `Removing location ${locationId} from bank for trip ${tripId} for user ${userId}`,
    );

    try {
      await this.bankCoordinationService.removeLocationFromBank(userId, tripId, locationId);

      this.logger.log(`Successfully removed location ${locationId} from bank for trip ${tripId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove location ${locationId} from bank for trip ${tripId}:`,
        error,
      );
      throw error;
    }
  }

  async getBankedLocations(userId: string, tripId: string): Promise<any[]> {
    this.logger.log(`Getting banked locations for trip ${tripId} for user ${userId}`);

    try {
      const bankedLocations = await this.bankCoordinationService.getBankedLocations(userId, tripId);

      this.logger.log(
        `Successfully retrieved ${bankedLocations.length} banked locations for trip ${tripId}`,
      );
      return bankedLocations;
    } catch (error) {
      this.logger.error(`Failed to get banked locations for trip ${tripId}:`, error);
      throw error;
    }
  }

  async promoteLocationToStop(
    userId: string,
    tripId: string,
    locationId: string,
    position?: number,
  ): Promise<Trip> {
    this.logger.log(
      `Promoting location ${locationId} to stop for trip ${tripId} for user ${userId}`,
    );

    try {
      await this.bankCoordinationService.promoteLocationToStop(
        userId,
        tripId,
        locationId,
        position,
      );

      this.logger.log(`Successfully promoted location ${locationId} to stop for trip ${tripId}`);
      const fullOptions: TripFindOptions = { includeStops: true, includeBankedLocations: true, includeTravelSegments: true };
      return this.tripService.findById(tripId, fullOptions);
    } catch (error) {
      this.logger.error(
        `Failed to promote location ${locationId} to stop for trip ${tripId}:`,
        error,
      );
      throw error;
    }
  }

  async generatePolylines(
    userId: string,
    tripId: string,
    options: { travelMode?: TravelMode; forceRecalculate?: boolean } = {},
  ): Promise<Trip> {
    this.logger.log(`Generating polylines for trip ${tripId} for user ${userId}`);

    try {
      // Validate trip ownership
      const trip = await this.sharedValidationService.validateTripAndOwnership(tripId, userId);

      // Check if polylines are needed
      const needsPolylines = await this.routingIntegrationService.needsPolylineGeneration(tripId);

      if (!needsPolylines && !options.forceRecalculate) {
        this.logger.log(`Trip ${tripId} already has polylines, skipping generation`);
        return trip;
      }

      // Use routing coordination service to generate detailed routing with polylines
      const routingData: UpdateTripRoutingDto = {
        tripId,
        travelMode: options.travelMode || 'DRIVING',
        forceRecalculate: options.forceRecalculate || false,
      };

      const updatedTrip = await this.routingIntegrationService.updateTripRouting(routingData);

      this.logger.log(`Successfully generated polylines for trip ${tripId}`);
      return updatedTrip;
    } catch (error) {
      this.logger.error(`Failed to generate polylines for trip ${tripId}:`, error);
      throw error;
    }
  }

  async getPolylineStatus(
    userId: string,
    tripId: string,
  ): Promise<{
    needsPolylines: boolean;
    hasCompleteRouting: boolean;
    segmentCount: number;
    segmentsWithPolylines: number;
  }> {
    this.logger.log(`Getting polyline status for trip ${tripId} for user ${userId}`);

    try {
      // Validate trip ownership
      await this.sharedValidationService.validateTripAndOwnership(tripId, userId);

      // Get routing summary
      const routingSummary = await this.routingIntegrationService.getTripRoutingSummary(tripId);
      
      // Check if polylines are specifically needed
      const needsPolylines = await this.routingIntegrationService.needsPolylineGeneration(tripId);
      
      // Get trip with segments to count polylines
      const trip = await this.tripService.findById(tripId, { includeTravelSegments: true });
      const segmentsWithPolylines = trip?.travelSegments?.filter(segment => !!segment.polyline).length || 0;

      const status = {
        needsPolylines: needsPolylines,
        hasCompleteRouting: routingSummary.hasCompleteRouting,
        segmentCount: routingSummary.segmentCount,
        segmentsWithPolylines,
      };

      this.logger.log(`Polyline status for trip ${tripId}:`, status);
      return status;
    } catch (error) {
      this.logger.error(`Failed to get polyline status for trip ${tripId}:`, error);
      throw error;
    }
  }
}
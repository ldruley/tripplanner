import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { TripCreationService } from './trip-creation.service';
import { BatchedTripCreationService } from './batched-trip-creation.service';
import { StopCoordinationService } from './stop-coordination.service';
import { RoutingCoordinationService } from './routing-coordination.service';
import { TripBankedLocationService } from './tripbankedlocation/trip-banked-location.service';
import { TimelineCoordinationService } from './timeline-coordination.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedLocationProcessingService } from './shared-location-processing.service';
import { TripService } from '@trip-planner/trip';
import {
  CreateTripFromOrderedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
  UpdateTripRoutingDto,
  UpdateTripWithRoutingDto,
} from '@trip-planner/shared/dtos';
import { Trip } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';
import { UpdateTripWithRoutingSchema } from '../../shared/types/src/schemas/itinerary.schema';
import { PrismaClientOrTransaction, PrismaService } from '@trip-planner/prisma';

@Injectable()
export class ItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(
    private readonly tripCreationService: TripCreationService,
    private readonly batchedTripCreationService: BatchedTripCreationService,
    private readonly stopCoordinationService: StopCoordinationService,
    private readonly routingCoordinationService: RoutingCoordinationService,
    private readonly bankCoordinationService: TripBankedLocationService,
    private readonly timelineCoordinationService: TimelineCoordinationService,
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly sharedValidationService: SharedValidationService,
    private readonly sharedLocationProcessingService: SharedLocationProcessingService,
  ) {}

  /**
   * Create a complete trip from an organized list of locations.
   * This is the main workflow for frontend trip creation.
   * @param userId - User ID who owns the trip.
   * @param data - Trip creation data with organized locations.
   * @return The created trip with all stops and routing.
   */
  async createTripFromOrganizedList(
    userId: string,
    data: CreateTripFromOrderedListDto,
  ): Promise<Trip> {
    this.logger.log(`Creating trip from organized list for user ${userId}: ${data.name}`);
    try {
      // Step 1: Create trip with stops
      const trip = await this.tripCreationService.createTripFromOrganizedList(userId, data);

      return await this.prismaService.$transaction(
        async (prismaClient: PrismaClientOrTransaction) => {
          // Step 2: Calculate routing if requested
          if (data.calculateRouting && trip.stops && trip.stops.length > 1) {
            this.logger.debug(`Calculating routing for trip ${trip.id}`);

            const routingData: UpdateTripRoutingDto = {
              tripId: trip.id,
              travelMode: data.travelMode,
              forceRecalculate: true,
            };

            const tripWithRouting = await this.routingCoordinationService.updateTripRouting(
              routingData,
              prismaClient,
            );

            // Calculate timeline after routing
            await this.timelineCoordinationService.recalculateAndUpdateTimeline(
              trip.id,
              prismaClient,
              true,
            );

            this.logger.log(`Successfully created trip ${trip.id} with routing and timeline`);
            return tripWithRouting;
          }

          this.logger.log(`Successfully created trip ${trip.id} without routing`);
          return trip;
        },
      );
    } catch (error) {
      this.logger.error(`Failed to create trip from organized list for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * EXPERIMENTAL: Create a complete trip using batched database operations.
   * This is an optimized version that reduces database operations from 3N + 2M to ~5-8 operations total.
   * @param userId - User ID who owns the trip.
   * @param data - Trip creation data with organized locations.
   * @return The created trip with all stops and routing.
   */
  async createTripFromOrganizedListBatched(
    userId: string,
    data: CreateTripFromOrderedListDto,
  ): Promise<Trip> {
    this.logger.log(
      `[EXPERIMENTAL] Creating trip from organized list with batching for user ${userId}: ${data.name}`,
    );
    try {
      // Use the batched trip creation service which includes routing AND timeline pre-calculation
      const trip = await this.batchedTripCreationService.createTripFromOrderedListBatched(
        userId,
        data,
      );

      this.logger.log(
        `[EXPERIMENTAL] Successfully created trip ${trip.id} with batched operations including timeline`,
      );

      // Trip is returned with all data already calculated - no additional operations needed
      return trip;
    } catch (error) {
      this.logger.error(
        `[EXPERIMENTAL] Failed to create trip from organized list with batching for user ${userId}:`,
        error,
      );
      throw error;
    }
  }




  /**
   * TRUE BATCHING: Add a stop to a trip using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where location creation, stop insertion, order adjustments,
   * routing calculation, and timeline calculation are all pre-calculated and applied atomically.
   *
   * @param userId - User ID who owns the trip.
   * @param data - Stop addition data.
   * @return The updated trip with the new stop.
   */
  async addStopToTripWithBatching(userId: string, data: AddStopToTripDto): Promise<Trip> {
    this.logger.log(
      `[TRUE BATCHING] Adding stop to trip with comprehensive batching ${data.tripId} for user ${userId}`,
    );

    // Validate trip ownership and grab full trip data
    const trip = await this.validateTrip(data.tripId, userId);
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

  /**
   * Validate trip ownership and retrieve full trip data.
   * Throws NotFoundException if trip does not exist or UnauthorizedException if user does not own the trip.
   *
   * @param tripId - Trip ID to validate.
   * @param userId - User ID who owns the trip.
   * @return The validated trip object.
   */
  private async validateTrip(tripId: string, userId: string) {
    const trip = await this.tripService.findById(tripId, true, true, true);
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedException(`Trip ${tripId} not owned by user`);
    }
    return trip;
  }

  /**
   * TRUE BATCHING: Remove a stop from a trip using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where stop deletion, order adjustments,
   * routing calculation, and timeline calculation are all pre-calculated and applied atomically.
   *
   * @param userId - User ID who owns the trip.
   * @param data - Stop removal data.
   * @return The updated trip without the removed stop.
   */
  async removeStopFromTripWithBatching(userId: string, data: RemoveStopFromTripDto): Promise<Trip> {
    this.logger.log(
      `[TRUE BATCHING] Removing stop from trip with comprehensive batching ${data.tripId} for user ${userId}`,
    );

    // Validate trip ownership and grab full trip data
    const trip = await this.validateTrip(data.tripId, userId);

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

  /**
   * TRUE BATCHING: Reorder stops using comprehensive pre-calculation and atomic batch updates.
   * This method implements true batching where each stop is updated once with all changes:
   * order, calculated times, routing, and timeline in a single coordinated operation.
   *
   * @param userId - User ID who owns the trip.
   * @param data - Reorder data.
   * @return The updated trip with reordered stops.
   */
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

  /**
   * Update routing for an entire trip.
   * @param userId - User ID who owns the trip.
   * @param data - Routing update data.
   * @return The updated trip with routing information.
   */
  async updateTripRouting(userId: string, data: UpdateTripRoutingDto): Promise<Trip> {
    this.logger.log(`Updating routing for trip ${data.tripId} for user ${userId}`);

    try {
      // Note: We should validate trip ownership here, but for now we'll trust the routing service
      const trip = await this.routingCoordinationService.updateTripRouting(data);

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

  /**
   * Get routing summary for a trip.
   * @param tripId - Trip ID.
   * @return Routing summary with total distance and duration.
   */
  async getTripRoutingSummary(tripId: string): Promise<{
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    hasCompleteRouting: boolean;
    segmentCount: number;
  }> {
    this.logger.debug(`Getting routing summary for trip ${tripId}`);

    try {
      const summary = await this.routingCoordinationService.getTripRoutingSummary(tripId);

      this.logger.debug(
        `Retrieved routing summary for trip ${tripId}: ${summary.segmentCount} segments`,
      );
      return summary;
    } catch (error) {
      this.logger.error(`Failed to get routing summary for trip ${tripId}:`, error);
      throw error;
    }
  }

  /**
   * Check if routing is needed for a trip.
   * @param tripId - Trip ID to check.
   * @param forceRecalculate - Whether to force recalculation.
   * @return True if routing is needed, false otherwise.
   */
  async isRoutingNeeded(tripId: string, forceRecalculate = false): Promise<boolean> {
    this.logger.debug(`Checking if routing is needed for trip ${tripId}`);

    try {
      const needed = await this.routingCoordinationService.isRoutingNeeded(
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

  /**
   * Calculate routing for a trip if needed.
   * @param tripId - Trip ID.
   * @param travelMode - Travel mode for routing.
   * @param forceRecalculate - Whether to force recalculation.
   * @return The updated trip with routing, or the original trip if routing wasn't needed.
   */
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
          const trip = await this.routingCoordinationService.updateTripRouting(
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

  /**
   * Update trip details and optionally recalculate routing.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to update.
   * @param data - Trip update data with routing options.
   * @return The updated trip with optional routing recalculation.
   */
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
          const tripWithStops = await this.tripService.findById(
            tripId,
            true,
            true,
            true,
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

            const tripWithRouting = await this.routingCoordinationService.updateTripRouting(
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

  /**
   * Add a location to trip bank.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to add location to.
   * @param locationId - Location ID to add to bank.
   * @return The banked location record.
   */
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

  /**
   * Remove a location from trip bank.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to remove location from.
   * @param locationId - Location ID to remove from bank.
   */
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

  /**
   * Get all banked locations for a trip.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to get banked locations for.
   * @return List of banked locations.
   */
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

  /**
   * Promote a banked location to a stop.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to promote location in.
   * @param locationId - Location ID to promote.
   * @param position - Optional position to insert stop at.
   * @return The updated trip with the new stop.
   */
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
      return this.tripService.findById(tripId, true, true, true);
    } catch (error) {
      this.logger.error(
        `Failed to promote location ${locationId} to stop for trip ${tripId}:`,
        error,
      );
      throw error;
    }
  }
}

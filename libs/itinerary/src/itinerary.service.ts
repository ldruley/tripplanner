import { Injectable, Logger } from '@nestjs/common';
import { TripCreationService } from './trip-creation.service';
import { StopCoordinationService } from './stop-coordination.service';
import { RoutingCoordinationService } from './routing-coordination.service';
import {
  CreateTripFromOrganizedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
  UpdateTripRoutingDto,
} from '@trip-planner/shared/dtos';
import { Trip } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

@Injectable()
export class ItineraryService {
  private readonly logger = new Logger(ItineraryService.name);

  constructor(
    private readonly tripCreationService: TripCreationService,
    private readonly stopCoordinationService: StopCoordinationService,
    private readonly routingCoordinationService: RoutingCoordinationService,
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
    data: CreateTripFromOrganizedListDto,
  ): Promise<Trip> {
    this.logger.log(`Creating trip from organized list for user ${userId}: ${data.name}`);

    try {
      // Step 1: Create trip with stops
      const trip = await this.tripCreationService.createTripFromOrganizedList(userId, data);

      // Step 2: Calculate routing if requested
      if (data.calculateRouting && trip.stops && trip.stops.length > 1) {
        this.logger.debug(`Calculating routing for trip ${trip.id}`);
        
        const routingData: UpdateTripRoutingDto = {
          tripId: trip.id!,
          travelMode: data.travelMode,
          forceRecalculate: true,
        };

        const tripWithRouting = await this.routingCoordinationService.updateTripRouting(routingData);
        
        this.logger.log(`Successfully created trip ${trip.id!} with routing`);
        return tripWithRouting;
      }

      this.logger.log(`Successfully created trip ${trip.id} without routing`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to create trip from organized list for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Add a stop to an existing trip with all side effects.
   * @param userId - User ID who owns the trip.
   * @param data - Stop addition data.
   * @return The updated trip with the new stop.
   */
  async addStopToTrip(
    userId: string,
    data: AddStopToTripDto,
  ): Promise<Trip> {
    this.logger.log(`Adding stop to trip ${data.tripId} for user ${userId}`);

    try {
      // Step 1: Add stop with coordination
      const trip = await this.stopCoordinationService.addStopToTrip(userId, data);

      // Step 2: Calculate routing if requested
      if (data.calculateRouting && trip.stops && trip.stops.length > 1) {
        this.logger.debug(`Calculating routing after adding stop to trip ${data.tripId}`);
        
        const routingData: UpdateTripRoutingDto = {
          tripId: data.tripId,
          travelMode: data.travelMode,
          forceRecalculate: true,
        };

        const tripWithRouting = await this.routingCoordinationService.updateTripRouting(routingData);
        
        this.logger.log(`Successfully added stop to trip ${data.tripId} with routing`);
        return tripWithRouting;
      }

      this.logger.log(`Successfully added stop to trip ${data.tripId} without routing`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to add stop to trip ${data.tripId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a stop from a trip with all side effects.
   * @param userId - User ID who owns the trip.
   * @param data - Stop removal data.
   * @return The updated trip without the removed stop.
   */
  async removeStopFromTrip(
    userId: string,
    data: RemoveStopFromTripDto,
  ): Promise<Trip> {
    this.logger.log(`Removing stop ${data.stopId} from trip ${data.tripId} for user ${userId}`);

    try {
      // Step 1: Remove stop with coordination
      const trip = await this.stopCoordinationService.removeStopFromTrip(userId, data);

      // Step 2: Calculate routing if requested and there are still enough stops
      if (data.calculateRouting && trip.stops && trip.stops.length > 1) {
        this.logger.debug(`Calculating routing after removing stop from trip ${data.tripId}`);
        
        const routingData: UpdateTripRoutingDto = {
          tripId: data.tripId,
          travelMode: data.travelMode,
          forceRecalculate: true,
        };

        const tripWithRouting = await this.routingCoordinationService.updateTripRouting(routingData);
        
        this.logger.log(`Successfully removed stop from trip ${data.tripId} with routing`);
        return tripWithRouting;
      }

      this.logger.log(`Successfully removed stop from trip ${data.tripId} without routing`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to remove stop from trip ${data.tripId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reorder stops in a trip with all side effects.
   * @param userId - User ID who owns the trip.
   * @param data - Reorder data.
   * @return The updated trip with reordered stops.
   */
  async reorderStops(
    userId: string,
    data: ItineraryReorderStopsDto,
  ): Promise<Trip> {
    this.logger.log(`Reordering stops in trip ${data.tripId} for user ${userId}`);

    try {
      // Step 1: Reorder stops with coordination
      const trip = await this.stopCoordinationService.reorderStops(userId, data);

      // Step 2: Calculate routing if requested
      if (data.calculateRouting && trip.stops && trip.stops.length > 1) {
        this.logger.debug(`Calculating routing after reordering stops in trip ${data.tripId}`);
        
        const routingData: UpdateTripRoutingDto = {
          tripId: data.tripId,
          travelMode: data.travelMode,
          forceRecalculate: true,
        };

        const tripWithRouting = await this.routingCoordinationService.updateTripRouting(routingData);
        
        this.logger.log(`Successfully reordered stops in trip ${data.tripId} with routing`);
        return tripWithRouting;
      }

      this.logger.log(`Successfully reordered stops in trip ${data.tripId} without routing`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to reorder stops in trip ${data.tripId} for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update routing for an entire trip.
   * @param userId - User ID who owns the trip.
   * @param data - Routing update data.
   * @return The updated trip with routing information.
   */
  async updateTripRouting(
    userId: string,
    data: UpdateTripRoutingDto,
  ): Promise<Trip> {
    this.logger.log(`Updating routing for trip ${data.tripId} for user ${userId}`);

    try {
      // Note: We should validate trip ownership here, but for now we'll trust the routing service
      const trip = await this.routingCoordinationService.updateTripRouting(data);
      
      this.logger.log(`Successfully updated routing for trip ${data.tripId}`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to update routing for trip ${data.tripId} for user ${userId}:`, error);
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
      
      this.logger.debug(`Retrieved routing summary for trip ${tripId}: ${summary.segmentCount} segments`);
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
      const needed = await this.routingCoordinationService.isRoutingNeeded(tripId, forceRecalculate);
      
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

      const trip = await this.routingCoordinationService.updateTripRouting(routingData);
      
      this.logger.log(`Successfully calculated routing for trip ${tripId}`);
      return trip;
    } catch (error) {
      this.logger.error(`Failed to calculate routing for trip ${tripId}:`, error);
      throw error;
    }
  }
}
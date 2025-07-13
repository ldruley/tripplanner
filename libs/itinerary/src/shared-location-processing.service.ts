import { Injectable, Logger } from '@nestjs/common';
import { LocationService } from '@trip-planner/location';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  CreateLocationRequest,
  LocationForItinerary,
  ProcessedLocation,
} from '@trip-planner/types';

@Injectable()
export class SharedLocationProcessingService {
  private readonly logger = new Logger(SharedLocationProcessingService.name);

  constructor(private readonly locationService: LocationService) {}

  /**
   * Process a single location for creation with deduplication.
   * Consolidates location creation logic from multiple services.
   * @param locationData - Location data to process (uses shared CreateLocationRequest type).
   * @param prismaClient - Prisma client for transaction.
   * @return Created or found location.
   */
  async processLocationForCreation(
    locationData: CreateLocationRequest,
    prismaClient?: PrismaClientOrTransaction,
  ) {
    const location = await this.locationService.create(
      locationData,
      {
        enableApiSourceMatching: true,
        enableExactCoordinateMatching: true,
      },
      prismaClient,
    );

    this.logger.debug(`Created/found location ${location.id} for ${locationData.name}`);
    return location;
  }

  /**
   * Process multiple locations for batch creation with deduplication.
   * Consolidates batch location processing from BatchedTripCreationService.
   * @param locations - Array of location data to process.
   * @param prismaClient - Prisma client for transaction.
   * @return Map of created locations indexed by key.
   */
  async batchProcessLocations(
    locations: ProcessedLocation[],
    prismaClient: PrismaClientOrTransaction,
  ) {
    return await this.locationService.batchCreateLocations(locations, prismaClient);
  }

  /**
   * Preprocess all locations (organized + banked) for batch operations.
   * PURE FUNCTION: No database calls, operates on input data.
   * Consolidates preprocessing logic from BatchedTripCreationService.
   * @param organizedLocations - Organized locations for the itinerary.
   * @param bankedLocations - Banked locations for the trip.
   * @return Processed location data with indexing.
   */
  preprocessAllLocations(
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
   * Calculate stop order changes needed when inserting a new stop at a specific position.
   * PURE FUNCTION: No database calls, operates on loaded stop data.
   * Consolidates order calculation logic from StopCoordinationService.
   * @param existingStops - Current stops in the trip.
   * @param insertOrder - Order position to insert at.
   * @return Array of stop order changes.
   */
  calculateStopOrderChangesForInsertion(
    existingStops: any[], // Using any for Stop type since it's complex
    insertOrder: number,
  ): { stopId: string; newOrder: number }[] {
    const changes: { stopId: string; newOrder: number }[] = [];

    // Find all stops at or after the insertion point and increment their orders
    for (const stop of existingStops) {
      if (stop.order >= insertOrder) {
        changes.push({
          stopId: stop.id as string,
          newOrder: stop.order + 1,
        });
      }
    }

    return changes;
  }

  /**
   * Calculate stop order changes needed when removing a stop at a specific position.
   * PURE FUNCTION: No database calls, operates on loaded stop data.
   * Consolidates order calculation logic from StopCoordinationService.
   * @param existingStops - Current stops in the trip.
   * @param removedOrder - Order position of the stop being removed.
   * @return Array of stop order changes.
   */
  calculateStopOrderChangesForRemoval(
    existingStops: any[], // Using any for Stop type since it's complex
    removedOrder: number,
  ): { stopId: string; newOrder: number }[] {
    const changes: { stopId: string; newOrder: number }[] = [];

    // Find all stops after the removed position and decrement their orders
    for (const stop of existingStops) {
      if (stop.order > removedOrder) {
        changes.push({
          stopId: stop.id as string,
          newOrder: stop.order - 1,
        });
      }
    }

    return changes;
  }
}

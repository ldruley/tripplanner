import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TripBankedLocationRepository } from './trip-banked-location.repository';
import {
  CreateLocationRequest,
  CreateTripBankedLocationRequest,
  TripBankedLocation,
  Location,
  CreateStopRequest,
  Stop,
} from '@trip-planner/types';
import { StopCoordinationService } from './stop-coordination.service';

@Injectable()
export class TripBankedLocationService {
  private readonly logger = new Logger(TripBankedLocationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly stopService: StopService,
    private readonly tripBankedLocationRepository: TripBankedLocationRepository,
    private readonly stopCoordinationService: StopCoordinationService,
  ) {}

  /**
   * Batch create bank relations for banked locations.
   * Reduces M bank operations to 1 operation.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID for the bank relations.
   * @param bankedLocationEntries - Banked location entries with keys.
   * @param prismaClient - Prisma client for transaction.
   */
  async batchCreateBankRelations(
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

  async addLocationToBank(
    userId: string,
    tripId: string,
    locationDataOrId: CreateLocationRequest | string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation> {
    this.logger.debug(`Adding location to bank for trip ${tripId} by user ${userId}`);

    const executeTransaction = async (client: PrismaClientOrTransaction) => {
      // Step 1: Validate trip ownership
      const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
        tripId,
        userId,
        client,
      );

      if (!tripBelongsToUser) {
        throw new NotFoundException(`Trip ${tripId} not found or not owned by user`);
      }

      let location: Location;

      // Step 2: Get or create location based on input type
      if (typeof locationDataOrId === 'string') {
        // Input is locationId
        const existingLocation = await this.locationService.findById(locationDataOrId, client);
        if (!existingLocation) {
          throw new NotFoundException(`Location ${locationDataOrId} not found`);
        }
        location = existingLocation;
      } else {
        // Input is location data - create or find existing location (with deduplication)
        location = await this.locationService.create(
          locationDataOrId,
          { enableExactCoordinateMatching: true, enableApiSourceMatching: true },
          client,
        );
        this.logger.debug(`Created/found location ${location.id} for ${locationDataOrId.name}`);
      }

      // Step 3: Check if location is already banked for this trip
      const existingBankedLocation = await this.tripBankedLocationRepository.exists(
        tripId,
        location.id as string,
        client,
      );

      if (existingBankedLocation) {
        throw new BadRequestException(`Location ${location.name} is already banked for this trip`);
      }

      // Step 4: Create the banked location
      const bankedLocationData: CreateTripBankedLocationRequest = {
        tripId,
        locationId: location.id as string,
      };

      const bankedLocation = await this.tripBankedLocationRepository.create(
        bankedLocationData,
        client,
      );

      this.logger.log(`Successfully added location ${location.name} to bank for trip ${tripId}`);

      return bankedLocation;
    };

    if (prismaClient) {
      return executeTransaction(prismaClient);
    } else {
      return await this.prismaService.$transaction(executeTransaction);
    }
  }

  /**
   * Remove a location from the trip's bank.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to remove location from.
   * @param locationId - Location ID to remove from bank.
   */
  async removeLocationFromBank(userId: string, tripId: string, locationId: string): Promise<void> {
    this.logger.debug(
      `Removing location ${locationId} from bank for trip ${tripId} by user ${userId}`,
    );

    return await this.prismaService.$transaction(async prismaClient => {
      // Step 1: Validate trip ownership
      const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
        tripId,
        userId,
        prismaClient,
      );

      if (!tripBelongsToUser) {
        throw new NotFoundException(`Trip ${tripId} not found or not owned by user`);
      }

      // Step 2: Check if location exists in bank
      const bankedLocation = await this.tripBankedLocationRepository.findByTripAndLocation(
        tripId,
        locationId,
        true,
        prismaClient,
      );

      if (!bankedLocation) {
        throw new NotFoundException(`Location ${locationId} is not banked for trip ${tripId}`);
      }

      // Step 3: Remove the banked location
      await this.tripBankedLocationRepository.delete(tripId, locationId, prismaClient);

      this.logger.log(
        `Successfully removed location ${bankedLocation.location?.name} from bank for trip ${tripId}`,
      );
    });
  }

  /**
   * Get all banked locations for a trip.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to get banked locations for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Array of banked locations with location details.
   */
  async getBankedLocations(
    userId: string,
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation[]> {
    this.logger.debug(`Getting banked locations for trip ${tripId} by user ${userId}`);

    const client = prismaClient || this.prismaService;

    // Step 1: Validate trip ownership
    const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
      tripId,
      userId,
      client,
    );

    if (!tripBelongsToUser) {
      throw new NotFoundException(`Trip ${tripId} not found or not owned by user`);
    }

    // Step 2: Get banked locations with location details
    const bankedLocations = await this.tripBankedLocationRepository.findByTripId(
      tripId,
      true,
      client,
    );

    this.logger.debug(`Found ${bankedLocations.length} banked locations for trip ${tripId}`);

    return bankedLocations;
  }

  /**
   * TODO: Move this to StopCoordinationService
   * Promote a banked location to a stop in the trip itinerary.
   * Removes the location from the bank and adds it as a stop.
   * @param userId - User ID who owns the trip.
   * @param tripId - Trip ID to promote location in.
   * @param locationId - Location ID to promote from bank to stop.
   * @param insertAtOrder - Optional order position to insert the stop at.
   * @return The created stop.
   */
  async promoteLocationToStop(
    userId: string,
    tripId: string,
    locationId: string,
    insertAtOrder?: number,
  ): Promise<Stop> {
    this.logger.debug(
      `Promoting location ${locationId} from bank to stop for trip ${tripId} by user ${userId}`,
    );

    return await this.prismaService.$transaction(
      async (transactionClient: PrismaClientOrTransaction) => {
        // Step 1: Validate trip ownership
        const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
          tripId,
          userId,
          transactionClient,
        );

        if (!tripBelongsToUser) {
          throw new NotFoundException(`Trip ${tripId} not found or not owned by user`);
        }

        // Step 2: Check if location exists in bank
        const bankedLocation = await this.tripBankedLocationRepository.findByTripAndLocation(
          tripId,
          locationId,
          true,
          transactionClient,
        );

        if (!bankedLocation) {
          throw new NotFoundException(`Location ${locationId} is not banked for trip ${tripId}`);
        }

        // Step 3: Check if location is already a stop in the trip
        const existingStop = await this.stopService.findByTripAndLocation(
          tripId,
          locationId,
          transactionClient,
        );

        if (existingStop) {
          throw new BadRequestException(
            `Location ${bankedLocation.location?.name} is already a stop in this trip`,
          );
        }

        // Step 4: Determine insertion order
        let insertOrder: number;
        if (insertAtOrder !== undefined) {
          insertOrder = insertAtOrder;
          // Make room for the new stop by reordering existing stops
          await this.stopCoordinationService.makeRoomForStop(
            tripId,
            insertOrder,
            transactionClient,
          );
        } else {
          // Add to the end
          insertOrder = await this.stopService.getNextOrderForTrip(tripId, transactionClient);
        }

        // Step 5: Create the stop
        const stopData: CreateStopRequest = {
          tripId,
          locationId,
          order: insertOrder,
          stopType: 'PITSTOP',
          plannedDuration: null,
        };

        const stop = await this.stopService.create(stopData, transactionClient);

        // Step 6: Remove from bank
        await this.tripBankedLocationRepository.delete(tripId, locationId, transactionClient);

        this.logger.log(
          `Successfully promoted location ${bankedLocation.location?.name} from bank to stop for trip ${tripId}`,
        );

        return stop;
      },
    );
  }

  /**
   * Make room for a new stop by incrementing the order of existing stops.
   * @param tripId - Trip ID.
   * @param insertOrder - Order position to insert at.
   * @param prismaClient - Prisma client for transaction.
   */
  private async makeRoomForStop(
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
}

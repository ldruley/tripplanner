import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction, Prisma } from '@trip-planner/prisma';
import {
  CreateTripBankedLocationRequest,
  TripBankedLocation,
  TripBankedLocationSearchCriteria,
} from '@trip-planner/types';

@Injectable()
export class TripBankedLocationRepository {
  private readonly logger = new Logger(TripBankedLocationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new banked location for a trip.
   * @param data - Trip banked location data to create.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The created trip banked location.
   */
  async create(
    data: CreateTripBankedLocationRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation> {
    const client = prismaClient || this.prisma;

    return client.tripBankedLocation.create({
      data: {
        tripId: data.tripId,
        locationId: data.locationId,
      },
    });
  }

  /**
   * Find a trip banked location by trip ID and location ID.
   * @param tripId - Trip ID.
   * @param locationId - Location ID.
   * @param includeTrip - Whether to include trip in the result.
   * @param includeLocation - Whether to include location in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip banked location or null if not found.
   */
  async findByTripAndLocation(
    tripId: string,
    locationId: string,
    includeTrip = false,
    includeLocation = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation | null> {
    const client = prismaClient || this.prisma;

    return client.tripBankedLocation.findUnique({
      where: {
        tripId_locationId: {
          tripId,
          locationId,
        },
      },
      include: {
        trip: includeTrip,
        location: includeLocation,
      },
    });
  }

  /**
   * Find all banked locations for a trip.
   * @param tripId - Trip ID to search for banked locations.
   * @param includeTrip - Whether to include trip in the result.
   * @param includeLocation - Whether to include location in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of banked locations for the trip.
   */
  async findByTripId(
    tripId: string,
    includeTrip = false,
    includeLocation = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation[]> {
    const client = prismaClient || this.prisma;

    return client.tripBankedLocation.findMany({
      where: { tripId },
      include: {
        trip: includeTrip,
        location: includeLocation,
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  /**
   * Find all trips that have banked a specific location.
   * @param locationId - Location ID to search for.
   * @param includeTrip - Whether to include trip in the result.
   * @param includeLocation - Whether to include location in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of trip banked locations for the location.
   */
  async findByLocationId(
    locationId: string,
    includeTrip = false,
    includeLocation = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation[]> {
    const client = prismaClient || this.prisma;

    return client.tripBankedLocation.findMany({
      where: { locationId },
      include: {
        trip: includeTrip,
        location: includeLocation,
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  /**
   * Search for trip banked locations based on criteria.
   * @param criteria - Search criteria including tripId, locationId, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of trip banked locations matching the criteria.
   */
  async search(
    criteria: TripBankedLocationSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripBankedLocation[]> {
    const client = prismaClient || this.prisma;

    const whereClause: Prisma.TripBankedLocationWhereInput = {};

    if (criteria.tripId) {
      whereClause.tripId = criteria.tripId;
    }

    if (criteria.locationId) {
      whereClause.locationId = criteria.locationId;
    }

    return client.tripBankedLocation.findMany({
      where: whereClause,
      include: {
        trip: criteria.includeTrip,
        location: criteria.includeLocation,
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  /**
   * Delete a banked location from a trip.
   * @param tripId - Trip ID.
   * @param locationId - Location ID.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(
    tripId: string,
    locationId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.tripBankedLocation.delete({
      where: {
        tripId_locationId: {
          tripId,
          locationId,
        },
      },
    });
  }

  /**
   * Delete all banked locations for a trip.
   * @param tripId - Trip ID.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Number of deleted records.
   */
  async deleteByTripId(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<number> {
    const client = prismaClient || this.prisma;

    const result = await client.tripBankedLocation.deleteMany({
      where: { tripId },
    });

    return result.count;
  }

  /**
   * Get the total number of banked locations for a trip.
   * @param tripId - Trip ID to count banked locations for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The total number of banked locations for the trip.
   */
  async getBankedLocationCount(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<number> {
    const client = prismaClient || this.prisma;

    return client.tripBankedLocation.count({
      where: { tripId },
    });
  }

  /**
   * Check if a location is banked for a trip.
   * @param tripId - Trip ID.
   * @param locationId - Location ID.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the location is banked for the trip, false otherwise.
   */
  async exists(
    tripId: string,
    locationId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
    const client = prismaClient || this.prisma;

    const count = await client.tripBankedLocation.count({
      where: {
        tripId,
        locationId,
      },
    });

    return count > 0;
  }
}
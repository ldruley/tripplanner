import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClient } from '@trip-planner/prisma';
import {
  CreateTripRequest,
  Trip,
  TripSearchCriteria,
  TripServiceUpdateRequest,
} from '@trip-planner/types';

@Injectable()
export class TripRepository {
  private readonly logger = new Logger(TripRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new trip in the database.
   * @param userId - User ID who owns the trip.
   * @param data - Trip data to create.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The created trip.
   */
  async create(
    userId: string,
    data: CreateTripRequest,
    prismaClient?: PrismaClient,
  ): Promise<Partial<Trip>> {
    const client = prismaClient || this.prisma;

    return client.trip.create({
      data: {
        userId,
        name: data.name,
        description: data.description || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      },
    });
  }

  /**
   * Find a trip by its ID.
   * @param id - Trip ID to search for.
   * @param includeStops - Whether to include stops in the result.
   * @param includeBankedLocations - Whether to include banked locations in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip or null if not found.
   */
  async findById(
    id: string,
    includeStops = false,
    includeBankedLocations = false,
    prismaClient?: PrismaClient,
  ): Promise<Trip | null> {
    const client = prismaClient || this.prisma;

    return await client.trip.findUnique({
      where: { id },
      include: {
        stops: includeStops
          ? {
              include: {
                location: true,
              },
              orderBy: {
                order: 'asc',
              },
            }
          : false,
        bankedLocations: includeBankedLocations
          ? {
              include: {
                location: true,
              },
              orderBy: {
                addedAt: 'desc',
              },
            }
          : false,
      },
    });
  }

  /**
   * Find trips by user ID.
   * @param userId - User ID to search for trips.
   * @param includeStops - Whether to include stops in the result.
   * @param includeBankedLocations - Whether to include banked locations in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of trips for the specified user.
   */
  async findByUserId(
    userId: string,
    includeStops = false,
    includeBankedLocations = false,
    prismaClient?: PrismaClient,
  ): Promise<Trip[]> {
    const client = prismaClient || this.prisma;

    return client.trip.findMany({
      where: { userId },
      include: {
        stops: includeStops
          ? {
              include: {
                location: true,
              },
              orderBy: {
                order: 'asc',
              },
            }
          : false,
        bankedLocations: includeBankedLocations
          ? {
              include: {
                location: true,
              },
              orderBy: {
                addedAt: 'desc',
              },
            }
          : false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Search for trips based on criteria.
   * @param criteria - Search criteria including userId, name, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of trips matching the criteria.
   */
  async search(criteria: TripSearchCriteria, prismaClient?: PrismaClient): Promise<Trip[]> {
    const client = prismaClient || this.prisma;

    const whereClause: any = {};

    if (criteria.userId) {
      whereClause.userId = criteria.userId;
    }

    if (criteria.name) {
      whereClause.name = {
        contains: criteria.name,
        mode: 'insensitive',
      };
    }

    return client.trip.findMany({
      where: whereClause,
      include: {
        stops: criteria.includeStops
          ? {
              include: {
                location: true,
              },
              orderBy: {
                order: 'asc',
              },
            }
          : false,
        bankedLocations: criteria.includeBankedLocations
          ? {
              include: {
                location: true,
              },
              orderBy: {
                addedAt: 'desc',
              },
            }
          : false,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Update an existing trip.
   * @param id - Trip ID to update.
   * @param data - Data to update the trip with.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated trip.
   */
  async update(
    id: string,
    data: TripServiceUpdateRequest,
    prismaClient?: PrismaClient,
  ): Promise<Partial<Trip>> {
    const client = prismaClient || this.prisma;

    const updateData: any = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }

    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate || null;
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate || null;
    }

    return client.trip.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a trip by its ID.
   * @param id - Trip ID to delete.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(id: string, prismaClient?: PrismaClient): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.trip.delete({
      where: { id },
    });
  }

  /**
   * Get the total number of trips for a user.
   * @param userId - User ID to count trips for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The total number of trips for the user.
   */
  async getTripCount(userId: string, prismaClient?: PrismaClient): Promise<number> {
    const client = prismaClient || this.prisma;

    return await client.trip.count({
      where: { userId },
    });
  }
}

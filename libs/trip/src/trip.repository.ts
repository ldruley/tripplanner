import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction, Prisma } from '@trip-planner/prisma';
import {
  CreateTripRequest,
  Trip,
  TripSearchCriteria,
  TripServiceUpdateRequest,
  CoordinateMatrix,
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
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    const client = prismaClient || this.prisma;

    // Handle matrix serialization for storage
    let matrixData: string | undefined = undefined;
    if (data.matrix) {
      matrixData = typeof data.matrix === 'string' ? data.matrix : JSON.stringify(data.matrix);
    }

    return client.trip.create({
      data: {
        userId,
        name: data.name,
        description: data.description || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        matrix: matrixData ? matrixData : undefined,
      },
    });
  }

  /**
   * Find a trip by its ID.
   * @param id - Trip ID to search for.
   * @param includeStops - Whether to include stops in the result.
   * @param includeBankedLocations - Whether to include banked locations in the result.
   * @param includeTravelSegments - Whether to include travel segments in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip or null if not found.
   */
  async findById(
    id: string,
    includeStops = false,
    includeBankedLocations = false,
    includeTravelSegments = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip | null> {
    const client = prismaClient || this.prisma;

    return client.trip.findUnique({
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
                createdAt: 'desc',
              },
            }
          : false,
        travelSegments: includeTravelSegments
          ? {
              orderBy: [{ originStop: { order: 'asc' } }, { destinationStop: { order: 'asc' } }],
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
   * @param includeTravelSegments - Whether to include travel segments in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of trips for the specified user.
   */
  async findByUserId(
    userId: string,
    includeStops = false,
    includeBankedLocations = false,
    includeTravelSegments = false,
    prismaClient?: PrismaClientOrTransaction,
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
                createdAt: 'desc',
              },
            }
          : false,
        travelSegments: includeTravelSegments
          ? {
              orderBy: [{ originStop: { order: 'asc' } }, { destinationStop: { order: 'asc' } }],
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
  async search(
    criteria: TripSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip[]> {
    const client = prismaClient || this.prisma;

    const whereClause: Prisma.TripWhereInput = {};

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
                createdAt: 'desc',
              },
            }
          : false,
        travelSegments: criteria.includeTravelSegments
          ? {
              orderBy: [{ originStop: { order: 'asc' } }, { destinationStop: { order: 'asc' } }],
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
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    const client = prismaClient || this.prisma;

    const updateData: Prisma.TripUpdateInput = {};

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
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
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
  async getTripCount(userId: string, prismaClient?: PrismaClientOrTransaction): Promise<number> {
    const client = prismaClient || this.prisma;

    return client.trip.count({
      where: { userId },
    });
  }

  /**
   * Find a trip with all related details for itinerary operations.
   * Includes stops with locations and all travel segments.
   * @param id - Trip ID to search for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip with full details or null if not found.
   */
  async findTripWithFullDetails(
    id: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip | null> {
    const client = prismaClient || this.prisma;

    return client.trip.findUnique({
      where: { id },
      include: {
        stops: {
          include: {
            location: true,
            segmentAsOrigin: {
              include: {
                originStop: true,
                destinationStop: true,
              },
            },
            segmentAsDestination: {
              include: {
                originStop: true,
                destinationStop: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        bankedLocations: {
          include: {
            location: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        travelSegments: {
          include: {
            originStop: {
              include: {
                location: true,
              },
            },
            destinationStop: {
              include: {
                location: true,
              },
            },
          },
          orderBy: [{ originStop: { order: 'asc' } }, { destinationStop: { order: 'asc' } }],
        },
      },
    });
  }

  /**
   * Find a trip with essential relations for itinerary updates.
   * Optimized query for orchestration operations.
   * @param id - Trip ID to search for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip with essential details or null if not found.
   */
  async findTripForItineraryUpdate(
    id: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip | null> {
    const client = prismaClient || this.prisma;

    return client.trip.findUnique({
      where: { id },
      include: {
        stops: {
          include: {
            location: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        travelSegments: {
          orderBy: [{ originStop: { order: 'asc' } }, { destinationStop: { order: 'asc' } }],
        },
        bankedLocations: {
          include: {
            location: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Update the matrix for a trip.
   * @param tripId - Trip ID to update.
   * @param matrix - Matrix data to store.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated trip.
   */
  async updateMatrix(
    tripId: string,
    matrix: CoordinateMatrix,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    const client = prismaClient || this.prisma;

    return client.trip.update({
      where: { id: tripId },
      data: {
        matrix: JSON.stringify(matrix),
      },
    });
  }
}

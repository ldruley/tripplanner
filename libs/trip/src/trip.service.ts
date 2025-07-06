import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  CreateTripRequest,
  Trip,
  TripSearchCriteria,
  TripServiceUpdateRequest,
} from '@trip-planner/types';
import { TripRepository } from './trip.repository';

@Injectable()
export class TripService {
  private readonly logger = new Logger(TripService.name);

  constructor(private readonly tripRepository: TripRepository) {}

  /**
   * Create a new trip for a user.
   * @param userId - User ID who owns the trip.
   * @param data - Data for the new trip.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The created trip.
   */
  async create(
    userId: string,
    data: CreateTripRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    // Validate dates if both are provided
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    this.logger.debug(`Creating trip for user ${userId}`);

    return await this.tripRepository.create(userId, data, prismaClient);
  }

  /**
   * Find a trip by its ID.
   * @param id - Trip ID to search for.
   * @param includeStops - Whether to include stops in the result.
   * @param includeBankedLocations - Whether to include banked locations in the result.
   * @param includeTravelSegments - Whether to include travel segments in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The trip with optional relations.
   */
  async findById(
    id: string,
    includeStops = false,
    includeBankedLocations = false,
    includeTravelSegments = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip> {
    const trip = await this.tripRepository.findById(
      id,
      includeStops,
      includeBankedLocations,
      includeTravelSegments,
      prismaClient,
    );

    if (!trip) {
      throw new NotFoundException(`Trip with ID ${id} not found`);
    }

    return trip;
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
    return await this.tripRepository.findByUserId(
      userId,
      includeStops,
      includeBankedLocations,
      includeTravelSegments,
      prismaClient,
    );
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
    return await this.tripRepository.search(criteria, prismaClient);
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
    // Validate dates if both are provided
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    // Verify trip exists
    await this.findById(id, false, false, false, prismaClient);

    this.logger.debug(`Updating trip ${id}`);

    return await this.tripRepository.update(id, data, prismaClient);
  }

  /**
   * Delete a trip by its ID.
   * @param id - Trip ID to delete.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    // Verify trip exists
    await this.findById(id, false, false, false, prismaClient);

    this.logger.debug(`Deleting trip ${id}`);

    await this.tripRepository.delete(id, prismaClient);
  }

  /**
   * Get the total number of trips for a user.
   * @param userId - User ID to count trips for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The total number of trips for the user.
   */
  async getTripCount(userId: string, prismaClient?: PrismaClientOrTransaction): Promise<number> {
    return await this.tripRepository.getTripCount(userId, prismaClient);
  }

  /**
   * Validate if a trip exists by ID.
   * @param id - Trip ID to check.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the trip exists, false if not found.
   */
  async validateTripExists(id: string, prismaClient?: PrismaClientOrTransaction): Promise<boolean> {
    try {
      await this.findById(id, false, false, false, prismaClient);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Validate if a trip belongs to a specific user.
   * @param tripId - Trip ID to check.
   * @param userId - User ID to validate against.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the trip belongs to the user, false otherwise.
   */
  async validateTripBelongsToUser(
    tripId: string,
    userId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
    const trip = await this.tripRepository.findById(tripId, false, false, false, prismaClient);
    return trip?.userId === userId;
  }
}

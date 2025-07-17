import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  CreateTripRequest,
  Trip,
  TripSearchCriteria,
  TripServiceUpdateRequest,
  CoordinateMatrix,
  CoordinateMatrixSchema,
  MatrixQuery,
  toCoordinateKey,
} from '@trip-planner/types';
import { TripRepository } from './trip.repository';
import { MatrixRoutingService } from '@trip-planner/matrix-routing';

@Injectable()
export class TripService {
  private readonly logger = new Logger(TripService.name);

  constructor(
    private readonly tripRepository: TripRepository,
    private readonly matrixRoutingService: MatrixRoutingService,
  ) {}

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

    // Validate matrix if provided
    if (data.matrix) {
      try {
        if (typeof data.matrix === 'string') {
          // Parse and validate if it's a string
          const parsedMatrix = JSON.parse(data.matrix);
          CoordinateMatrixSchema.parse(parsedMatrix);
        } else {
          // Validate if it's already an object
          CoordinateMatrixSchema.parse(data.matrix);
        }
      } catch (error) {
        throw new BadRequestException('Invalid matrix format provided');
      }
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

    await this.tripRepository.update(id, data, prismaClient);

    // Return the updated trip with all relations
    return await this.findById(id, true, true, true, prismaClient);
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

  /**
   * Update the matrix for a trip.
   * @param tripId - Trip ID to update.
   * @param matrix - Matrix data to store.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated trip.
   */
  async updateTripMatrix(
    tripId: string,
    matrix: CoordinateMatrix,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    // Validate the matrix structure
    const validatedMatrix = CoordinateMatrixSchema.parse(matrix);

    this.logger.debug(`Updating matrix for trip ${tripId}`);

    // Verify trip exists
    await this.findById(tripId, false, false, false, prismaClient);

    await this.tripRepository.updateMatrix(tripId, validatedMatrix, prismaClient);

    // Return the updated trip
    return await this.findById(tripId, true, true, true, prismaClient);
  }

  /**
   * Get the matrix for a trip.
   * @param tripId - Trip ID to get matrix for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Matrix data or null if not found.
   */
  async getTripMatrix(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<CoordinateMatrix | null> {
    const trip = await this.findById(tripId, false, false, false, prismaClient);

    if (!trip?.matrix) {
      return null;
    }

    try {
      // Parse the stored JSON matrix
      const matrix = typeof trip.matrix === 'string' ? JSON.parse(trip.matrix) : trip.matrix;
      return CoordinateMatrixSchema.parse(matrix);
    } catch (error) {
      this.logger.error(`Invalid matrix data for trip ${tripId}:`, error);
      return null;
    }
  }

  /**
   * Determine if a trip's matrix should be refreshed.
   * @param tripId - Trip ID to check.
   * @param forceRefresh - Force refresh regardless of current state.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if matrix should be refreshed.
   */
  async shouldRefreshMatrix(
    tripId: string,
    forceRefresh = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
    if (forceRefresh) {
      return true;
    }

    const trip = await this.findById(tripId, true, true, false, prismaClient);

    if (!trip) {
      return false;
    }

    // If no matrix exists, refresh is needed
    if (!trip.matrix) {
      return true;
    }

    // If trip has less than 2 locations total, no matrix needed
    const totalLocations = (trip.stops?.length || 0) + (trip.bankedLocations?.length || 0);
    if (totalLocations < 2) {
      return false;
    }

    // Check if matrix covers all current locations
    const currentMatrix = await this.getTripMatrix(tripId, prismaClient);
    if (!currentMatrix) {
      return true;
    }

    // Generate coordinate keys for all locations
    const coordinateKeys = new Set<string>();

    // Add stops
    if (trip.stops) {
      for (const stop of trip.stops) {
        if (stop.location) {
          coordinateKeys.add(toCoordinateKey({
            lat: stop.location.latitude,
            lng: stop.location.longitude
          }));
        }
      }
    }

    // Add banked locations
    if (trip.bankedLocations) {
      for (const banked of trip.bankedLocations) {
        if (banked.location) {
          coordinateKeys.add(toCoordinateKey({
            lat: banked.location.latitude,
            lng: banked.location.longitude
          }));
        }
      }
    }

    // Check if all coordinate keys exist in the matrix
    const matrixKeys = Object.keys(currentMatrix);
    for (const key of coordinateKeys) {
      if (!matrixKeys.includes(key)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Refresh the matrix for a trip by fetching new routing data.
   * @param tripId - Trip ID to refresh matrix for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated trip with new matrix.
   */
  async refreshTripMatrix(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
    inMemoryTrip?: Trip,
  ): Promise<Partial<Trip>> {
    this.logger.debug(`Refreshing matrix for trip ${tripId}`);

    const trip = inMemoryTrip || await this.findById(tripId, true, true, false, prismaClient);

    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // DEBUG: Log trip data and collections
    this.logger.debug(`DEBUG refreshTripMatrix - Trip ID: ${tripId}`);
    this.logger.debug(`DEBUG refreshTripMatrix - Trip stops count: ${trip.stops?.length || 0}`);
    this.logger.debug(`DEBUG refreshTripMatrix - Trip banked locations count: ${trip.bankedLocations?.length || 0}`);
    
    if (trip.stops) {
      trip.stops.forEach((stop, index) => {
        this.logger.debug(`DEBUG refreshTripMatrix - Stop ${index}: id=${stop.id}, order=${stop.order}, location=${stop.location ? `${stop.location.latitude},${stop.location.longitude}` : 'null'}`);
      });
    }
    
    if (trip.bankedLocations) {
      trip.bankedLocations.forEach((banked, index) => {
        this.logger.debug(`DEBUG refreshTripMatrix - Banked ${index}: id=${banked.id}, location=${banked.location ? `${banked.location.latitude},${banked.location.longitude}` : 'null'}`);
      });
    }

    // Collect all locations from stops and banked locations
    const coordinates: { lat: number; lng: number }[] = [];

    this.logger.debug(`Trip ${tripId} has ${trip.stops?.length || 0} stops and ${trip.bankedLocations?.length || 0} banked locations`);

    // Add stops
    if (trip.stops) {
      for (const stop of trip.stops) {
        if (stop.location) {
          coordinates.push({
            lat: stop.location.latitude,
            lng: stop.location.longitude
          });
          this.logger.debug(`Added stop ${stop.id} coordinates: ${stop.location.latitude}, ${stop.location.longitude}`);
        } else {
          this.logger.warn(`Stop ${stop.id} has no location data`);
        }
      }
    }

    // Add banked locations
    if (trip.bankedLocations) {
      for (const banked of trip.bankedLocations) {
        if (banked.location) {
          coordinates.push({
            lat: banked.location.latitude,
            lng: banked.location.longitude
          });
          this.logger.debug(`Added banked location ${banked.id} coordinates: ${banked.location.latitude}, ${banked.location.longitude}`);
        } else {
          this.logger.warn(`Banked location ${banked.id} has no location data`);
        }
      }
    }

    this.logger.debug(`Trip ${tripId} matrix refresh: collected ${coordinates.length} total coordinates`);

    // DEBUG: Log final coordinates array
    this.logger.debug(`DEBUG refreshTripMatrix - Final coordinates array (${coordinates.length} items):`);
    coordinates.forEach((coord, index) => {
      this.logger.debug(`DEBUG refreshTripMatrix - Coordinate ${index}: ${coord.lat},${coord.lng}`);
    });

    // Need at least 2 locations for matrix calculation
    if (coordinates.length < 2) {
      this.logger.warn(`Trip ${tripId} has fewer than 2 locations, skipping matrix refresh`);
      return trip;
    }

    // Fetch new matrix from routing service
    const matrixQuery: MatrixQuery = {
      origins: coordinates,
      profile: 'carFast',
      routingMode: 'fast',
    };

    this.logger.debug(`Trip ${tripId} sending ${coordinates.length} coordinates to matrix service`);

    const newMatrix = await this.matrixRoutingService.getMatrixRouting(matrixQuery);

    this.logger.debug(`Trip ${tripId} received matrix with ${Object.keys(newMatrix).length} coordinate keys`);

    // DEBUG: Log detailed matrix response
    this.logger.debug(`DEBUG refreshTripMatrix - Matrix service response:`);
    this.logger.debug(`DEBUG refreshTripMatrix - Matrix dimensions: ${Object.keys(newMatrix).length}x${Object.keys(newMatrix).length}`);
    this.logger.debug(`DEBUG refreshTripMatrix - Matrix coordinate keys: ${Object.keys(newMatrix).join(', ')}`);
    
    // Log first few entries to verify structure
    const matrixKeys = Object.keys(newMatrix);
    matrixKeys.slice(0, Math.min(3, matrixKeys.length)).forEach(key => {
      const destinations = Object.keys(newMatrix[key] || {});
      this.logger.debug(`DEBUG refreshTripMatrix - Matrix[${key}] has ${destinations.length} destinations: ${destinations.join(', ')}`);
    });

    // DEBUG: Final verification before updating trip matrix
    this.logger.debug(`DEBUG refreshTripMatrix - About to call updateTripMatrix with matrix containing ${Object.keys(newMatrix).length} coordinate keys`);
    this.logger.debug(`DEBUG refreshTripMatrix - Matrix keys being passed: ${Object.keys(newMatrix).join(', ')}`);

    // Update the trip with new matrix
    return await this.updateTripMatrix(tripId, newMatrix, prismaClient);
  }

  /**
   * Refresh matrix when a stop is added to a persisted trip.
   * @param tripId - Trip ID to refresh matrix for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated trip with refreshed matrix.
   */
  async refreshMatrixOnStopAddition(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Partial<Trip>> {
    this.logger.debug(`Refreshing matrix for trip ${tripId} after stop addition`);

    // Always refresh matrix when stops are added
    return await this.refreshTripMatrix(tripId, prismaClient);
  }

  /**
   * Update the timeline recalculation flag for a trip.
   * @param tripId - Trip ID to update.
   * @param needsRecalculation - Whether timeline recalculation is needed.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async updateTimelineRecalculationFlag(
    tripId: string,
    needsRecalculation: boolean,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    this.logger.debug(`Updating timeline recalculation flag for trip ${tripId} to ${needsRecalculation}`);

    await this.tripRepository.updateTimelineRecalculationFlag(tripId, needsRecalculation, prismaClient);
  }

  /**
   * Update the routing recalculation flag for a trip.
   * @param tripId - Trip ID to update.
   * @param needsRecalculation - Whether routing recalculation is needed.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async updateRoutingRecalculationFlag(
    tripId: string,
    needsRecalculation: boolean,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    this.logger.debug(`Updating routing recalculation flag for trip ${tripId} to ${needsRecalculation}`);

    await this.tripRepository.updateRoutingRecalculationFlag(tripId, needsRecalculation, prismaClient);
  }

  /**
   * Update both dirty flags for a trip.
   * @param tripId - Trip ID to update.
   * @param needsRoutingRecalculation - Whether routing recalculation is needed.
   * @param needsTimelineRecalculation - Whether timeline recalculation is needed.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async updateTripDirtyFlags(
    tripId: string,
    needsRoutingRecalculation: boolean,
    needsTimelineRecalculation: boolean,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    this.logger.debug(`Updating dirty flags for trip ${tripId}: routing=${needsRoutingRecalculation}, timeline=${needsTimelineRecalculation}`);

    await this.tripRepository.updateTripDirtyFlags(tripId, needsRoutingRecalculation, needsTimelineRecalculation, prismaClient);
  }
}

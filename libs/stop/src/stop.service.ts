import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  BulkStopUpdateRequest,
  CreateStopRequest,
  LocationForItinerary,
  ReorderStopsRequest,
  Stop,
  StopOrderUpdate,
  StopSearchCriteria,
  StopWithLocation,
  UpdateStopRequest,
  Location,
  ComprehensiveStopUpdate,
} from '@trip-planner/types';
import { StopRepository } from './stop.repository';

@Injectable()
export class StopService {
  private readonly logger = new Logger(StopService.name);

  constructor(private readonly stopRepository: StopRepository) {}

  /**
   * Create a new stop for a trip.
   * @param data - Data for the new stop.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The created stop.
   */
  async create(data: CreateStopRequest, prismaClient?: PrismaClientOrTransaction): Promise<Stop> {
    // Validate order is not negative
    if (data.order < 0) {
      throw new BadRequestException('Stop order must be non-negative');
    }

    // Validate planned duration if provided
    if (!!data.plannedDuration && data.plannedDuration < 0) {
      throw new BadRequestException('Planned duration must be non-negative');
    }

    this.logger.debug(`Creating stop for trip ${data.tripId} at order ${data.order}`);

    return await this.stopRepository.create(data, prismaClient);
  }

  /**
   * Batch create all stops in a single database operation.
   * Reduces N stop operations to 1 operation.
   * @param tripId - Trip ID for the stops.
   * @param organizedLocationEntries - Organized location entries with keys.
   * @param originalOrganizedLocations - Original organized location data.
   * @param prismaClient - Prisma client for transaction.
   * @return Array of created stops.
   */
  async batchCreateStops(
    tripId: string,
    organizedLocationEntries: [string, Location][],
    originalOrganizedLocations: LocationForItinerary[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    // Build stop creation data
    const stopCreateData = organizedLocationEntries.map(([key, location]) => {
      const originalIndex = parseInt(key.split('_')[1]);
      const originalLocation = originalOrganizedLocations[originalIndex];

      return {
        tripId,
        locationId: location.id as string,
        order: originalLocation.order,
        plannedArrivalTime: null,
        plannedDuration: null,
        stopType: 'PITSTOP' as const,
        notes: null,
        alias: null,
      };
    });

    // Sort by order to ensure correct creation sequence
    stopCreateData.sort((a, b) => a.order - b.order);

    // Batch create all stops
    const createdStops = await prismaClient.stop.createManyAndReturn({
      data: stopCreateData,
    });

    return createdStops;
  }

  /**
   * Find a stop by its ID.
   * @param id - Stop ID to search for.
   * @param includeLocation - Whether to include location details in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The stop with or without location details.
   */
  async findById(
    id: string,
    includeLocation = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop | StopWithLocation> {
    const stop = includeLocation
      ? await this.stopRepository.findByIdWithLocation(id, prismaClient)
      : await this.stopRepository.findById(id, prismaClient);

    if (!stop) {
      throw new NotFoundException(`Stop with ID ${id} not found`);
    }

    return stop;
  }

  /**
   * Find stops by trip ID.
   * @param tripId - Trip ID to search for stops.
   * @param includeLocations - Whether to include location details in the result.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of stops for the specified trip.
   */
  async findByTripId(
    tripId: string,
    includeLocations = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[] | StopWithLocation[]> {
    return includeLocations
      ? await this.stopRepository.findByTripIdWithLocations(tripId, prismaClient)
      : await this.stopRepository.findByTripId(tripId, prismaClient);
  }

  /**
   * Find a stop by trip ID and location ID.
   * @param tripId - Trip ID to search in.
   * @param locationId - Location ID to search for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The stop or null if not found.
   */
  async findByTripAndLocation(
    tripId: string,
    locationId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop | null> {
    return await this.stopRepository.findByTripAndLocation(tripId, locationId, prismaClient);
  }

  async getTripId(stopId: string, prismaClient?: PrismaClientOrTransaction): Promise<string> {
    const stop = await this.stopRepository.findById(stopId, prismaClient);
    if (!stop) {
      throw new NotFoundException(`Stop with ID ${stopId} not found`);
    }
    return stop.tripId;
  }

  /**
   * Search for stops based on criteria.
   * @param criteria - Search criteria including tripId, locationId, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of stops matching the criteria.
   */
  async search(
    criteria: StopSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[] | StopWithLocation[]> {
    return await this.stopRepository.search(criteria, prismaClient);
  }

  /**
   * Update an existing stop.
   * @param id - Stop ID to update.
   * @param data - Data to update the stop with.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated stop.
   */
  async update(
    id: string,
    data: UpdateStopRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    // Validate planned duration if provided
    if (!!data.plannedDuration && data.plannedDuration < 0) {
      throw new BadRequestException('Planned duration must be non-negative');
    }

    // Verify stop exists
    await this.findById(id, false, prismaClient);

    this.logger.debug(`Updating stop ${id}`);

    return await this.stopRepository.update(id, data, prismaClient);
  }

  /**
   * Update the order of a stop within its trip.
   * @param id - Stop ID to update.
   * @param newOrder - New order index for the stop.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated stop with new order.
   */
  async updateOrder(
    id: string,
    newOrder: number,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    if (newOrder < 0) {
      throw new BadRequestException('Stop order must be non-negative');
    }

    // Verify stop exists
    await this.findById(id, false, prismaClient);

    this.logger.debug(`Updating stop ${id} order to ${newOrder}`);

    return await this.stopRepository.updateOrder(id, newOrder, prismaClient);
  }

  /**
   * Reorder stops for a trip based on provided stop IDs.
   * The order of IDs in the array determines the new order of stops.
   * @param request - Contains tripId and array of stopIds in new order.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated list of stops in the new order.
   */
  async reorderStops(
    request: ReorderStopsRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    const { tripId, stopIds } = request;

    if (stopIds.length === 0) {
      throw new BadRequestException('Stop IDs array cannot be empty');
    }

    // Verify all stops exist and belong to the trip
    const existingStops = await this.stopRepository.findByTripId(tripId, prismaClient);
    const existingStopIds = existingStops.map(stop => stop.id);

    // Check if all provided IDs exist
    const invalidIds = stopIds.filter(id => !existingStopIds.includes(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid stop IDs: ${invalidIds.join(', ')}`);
    }

    // Check if all existing stops are included
    if (stopIds.length !== existingStops.length) {
      throw new BadRequestException('All stops for the trip must be included in reorder operation');
    }

    this.logger.debug(`Reordering ${stopIds.length} stops for trip ${tripId}`);

    // Create order updates
    const orderUpdates: StopOrderUpdate[] = stopIds.map((stopId, index) => ({
      id: stopId,
      order: index,
    }));

    return await this.stopRepository.bulkUpdateOrders(orderUpdates, prismaClient);
  }

  /**
   * Calculate which stops need order changes based on new stop orders.
   * @param stops - Array of stops to check for order changes.
   * @param newStopOrders - Array of new stop orders to apply.
   * @return Array of stop updates needed.
   */
  calculateStopOrderChanges(
    stops: Stop[],
    newStopOrders: { stopId: string; newOrder: number }[],
  ): { stopId: string; newOrder: number }[] {
    const stopOrderMap = new Map(newStopOrders.map(so => [so.stopId, so.newOrder]));
    const changes: { stopId: string; newOrder: number }[] = [];

    for (const stop of stops) {
      const newOrder = stopOrderMap.get(stop.id as string);
      if (newOrder !== undefined && newOrder !== stop.order) {
        changes.push({ stopId: stop.id as string, newOrder });
      }
    }

    return changes;
  }

  /**
   * Update calculated arrival and departure times for a stop.
   * @param id - Stop ID to update.
   * @param calculatedArrivalTime - New calculated arrival time.
   * @param calculatedDepartureTime - New calculated departure time.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated stop with new calculated times.
   */
  async updateCalculatedTimes(
    id: string,
    calculatedArrivalTime?: Date,
    calculatedDepartureTime?: Date,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    // Verify stop exists
    await this.findById(id, false, prismaClient);

    this.logger.debug(`Updating calculated times for stop ${id}`);

    return await this.stopRepository.updateCalculatedTimes(
      id,
      calculatedArrivalTime,
      calculatedDepartureTime,
      prismaClient,
    );
  }

  /**
   * Delete a stop by its ID.
   * @param id - Stop ID to delete.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    // Verify stop exists
    await this.findById(id, false, prismaClient);

    this.logger.debug(`Deleting stop ${id}`);

    await this.stopRepository.delete(id, prismaClient);
  }

  /**
   * Delete all stops for a specific trip.
   * @param tripId - Trip ID to delete stops for.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async deleteByTripId(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    this.logger.debug(`Deleting all stops for trip ${tripId}`);

    await this.stopRepository.deleteByTripId(tripId, prismaClient);
  }

  /**
   * Get the next order index for a new stop in a trip.
   * @param tripId - Trip ID to get the next order for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The next order index for the trip.
   */
  async getNextOrderForTrip(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<number> {
    return await this.stopRepository.getNextOrderForTrip(tripId, prismaClient);
  }

  /**
   * Get the total number of stops for a trip.
   * @param tripId - Trip ID to count stops for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The total number of stops in the trip.
   */
  async getStopCount(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<number> {
    return await this.stopRepository.getStopCount(tripId, prismaClient);
  }

  /**
   * Validate if a stop exists by ID.
   * @param id - Stop ID to check.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the stop exists, false if not found.
   */
  async validateStopExists(id: string, prismaClient?: PrismaClientOrTransaction): Promise<boolean> {
    try {
      await this.findById(id, false, prismaClient);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Validate if a stop belongs to a specific trip.
   * @param stopId - Stop ID to check.
   * @param tripId - Trip ID to validate against.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the stop belongs to the trip, false otherwise.
   */
  async validateStopBelongsToTrip(
    stopId: string,
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
    const stop = await this.stopRepository.findById(stopId, prismaClient);
    return stop?.tripId === tripId;
  }

  /**
   * Batch update all stop fields in single operations per stop.
   * This enables true batching where each stop is updated once with all changes.
   * @param updates - Array of comprehensive stop updates with order, calculated times, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Array of updated stops.
   */
  async batchUpdateStopsComprehensive(
    updates: ComprehensiveStopUpdate[],
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    if (updates.length === 0) {
      return [];
    }

    this.logger.debug(`Batch updating ${updates.length} stops with comprehensive data`);

    return await this.stopRepository.batchUpdateStopsComprehensive(updates, prismaClient);
  }
}

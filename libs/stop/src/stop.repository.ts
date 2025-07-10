import { Injectable } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction, Prisma } from '@trip-planner/prisma';
import {
  CreateStopRequest,
  Stop,
  StopOrderUpdate,
  StopSearchCriteria,
  StopWithLocation,
  UpdateStopRequest,
} from '@trip-planner/types';

@Injectable()
export class StopRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new stop
   * @param data - Stop creation data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Created Stop
   */
  async create(data: CreateStopRequest, prismaClient?: PrismaClientOrTransaction): Promise<Stop> {
    const client = prismaClient || this.prisma;

    return client.stop.create({
      data: {
        tripId: data.tripId,
        locationId: data.locationId,
        order: data.order,
        plannedArrivalTime: data.plannedArrivalTime || null,
        plannedDuration: data.plannedDuration || null,
        stopType: data.stopType || null,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Find a stop by its ID
   * @param id - Stop ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found Stop or null if not found
   */
  async findById(id: string, prismaClient?: PrismaClientOrTransaction): Promise<Stop | null> {
    const client = prismaClient || this.prisma;

    return client.stop.findUnique({
      where: { id },
    });
  }

  /**
   * Find a stop by its ID with location details
   * @param id - Stop ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found Stop with Location or null if not found
   */
  async findByIdWithLocation(
    id: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<StopWithLocation | null> {
    const client = prismaClient || this.prisma;

    return client.stop.findUnique({
      where: { id },
      include: {
        location: true,
      },
    });
  }

  /**
   * Find all stops for a given trip ID
   * @param tripId - Trip ID to find stops for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Stops for the trip
   */
  async findByTripId(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<Stop[]> {
    const client = prismaClient || this.prisma;

    return client.stop.findMany({
      where: { tripId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Find a stop by trip ID and location ID
   * @param tripId - Trip ID to search in
   * @param locationId - Location ID to search for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found Stop or null if not found
   */
  async findByTripAndLocation(
    tripId: string,
    locationId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop | null> {
    const client = prismaClient || this.prisma;

    return client.stop.findFirst({
      where: {
        tripId,
        locationId,
      },
    });
  }

  /**
   * Find all stops for a given trip ID with location details
   * @param tripId - Trip ID to find stops for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Stops with Location details for the trip
   */
  async findByTripIdWithLocations(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    const client = prismaClient || this.prisma;

    return client.stop.findMany({
      where: { tripId },
      include: {
        location: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Search stops based on criteria
   * @param criteria - Search criteria
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Stops matching the criteria
   */
  async search(
    criteria: StopSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[] | Stop[]> {
    const client = prismaClient || this.prisma;

    const whereClause: Prisma.StopWhereInput = {};

    if (criteria.tripId) {
      whereClause.tripId = criteria.tripId;
    }

    if (criteria.locationId) {
      whereClause.locationId = criteria.locationId;
    }

    if (criteria.stopType) {
      whereClause.stopType = criteria.stopType;
    }

    const includeClause = criteria.includeLocation
      ? {
          location: true,
        }
      : undefined;

    return client.stop.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Update an existing stop
   * @param id - Stop ID to update
   * @param data - Update data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated Stop
   */
  async update(
    id: string,
    data: UpdateStopRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    const client = prismaClient || this.prisma;

    const updateData: Prisma.StopUpdateInput = {};

    if (data.plannedArrivalTime !== undefined)
      updateData.plannedArrivalTime = data.plannedArrivalTime;
    if (data.plannedDuration !== undefined) updateData.plannedDuration = data.plannedDuration;
    if (data.stopType !== undefined) updateData.stopType = data.stopType;
    if (data.notes !== undefined) updateData.notes = data.notes;

    return client.stop.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update the order of a stop
   * @param id - Stop ID to update
   * @param newOrder - New order value
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated Stop with new order
   */
  async updateOrder(
    id: string,
    newOrder: number,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    const client = prismaClient || this.prisma;

    return client.stop.update({
      where: { id },
      data: { order: newOrder },
    });
  }

  /**
   * Bulk update orders of multiple stops
   * @param updates - Array of order updates
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of updated Stops
   */
  async bulkUpdateOrders(
    updates: StopOrderUpdate[],
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop[]> {
    const client = prismaClient || this.prisma;

    const updatedStops: Stop[] = [];

    for (const update of updates) {
      const stop = await client.stop.update({
        where: { id: update.id },
        data: { order: update.order },
      });
      updatedStops.push(stop);
    }

    return updatedStops;
  }

  /**
   * Update calculated arrival and departure times for a stop
   * @param id - Stop ID to update
   * @param calculatedArrivalTime - New calculated arrival time
   * @param calculatedDepartureTime - New calculated departure time
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated Stop with new calculated times
   */
  async updateCalculatedTimes(
    id: string,
    calculatedArrivalTime?: Date,
    calculatedDepartureTime?: Date,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Stop> {
    const client = prismaClient || this.prisma;

    const updateData: Prisma.StopUpdateInput = {};
    if (calculatedArrivalTime !== undefined)
      updateData.calculatedArrivalTime = calculatedArrivalTime;
    if (calculatedDepartureTime !== undefined)
      updateData.calculatedDepartureTime = calculatedDepartureTime;

    return client.stop.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a stop by its ID
   * @param id - Stop ID to delete
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.stop.delete({
      where: { id },
    });
  }

  /**
   * Delete all stops for a given trip ID
   * @param tripId - Trip ID to delete stops for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async deleteByTripId(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.stop.deleteMany({
      where: { tripId },
    });
  }

  /**
   * Get the next order number for a new stop in a trip
   * @param tripId - Trip ID to get the next order for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Next order number
   */
  async getNextOrderForTrip(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<number> {
    const client = prismaClient || this.prisma;

    const maxOrderStop = await client.stop.findFirst({
      where: { tripId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return (maxOrderStop?.order || 0) + 1;
  }

  /**
   * Get the total count of stops for a trip
   * @param tripId - Trip ID to count stops for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Count of stops for the trip
   */
  async getStopCount(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<number> {
    const client = prismaClient || this.prisma;

    return client.stop.count({
      where: { tripId },
    });
  }
}

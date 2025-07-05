import { Injectable } from '@nestjs/common';
import { PrismaService, PrismaClient } from '@trip-planner/prisma';
import {
  CreateTravelSegmentRequest,
  TravelSegment,
  TravelSegmentSearchCriteria,
  UpdateTravelSegmentRequest,
} from '@trip-planner/types';

@Injectable()
export class TravelSegmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new travel segment
   * @param data - Travel segment creation data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Created TravelSegment
   */
  async create(data: CreateTravelSegmentRequest, prismaClient?: PrismaClient): Promise<TravelSegment> {
    const client = prismaClient || this.prisma;

    const segment = await client.travelSegment.create({
      data: {
        tripId: data.tripId,
        originStopId: data.originStopId,
        destinationStopId: data.destinationStopId,
        travelMode: (data.travelMode as any) || null,
        distance: data.distance || null,
        duration: data.duration || null,
        apiCalculatedDistance: data.apiCalculatedDistance || null,
        apiCalculatedDuration: data.apiCalculatedDuration || null,
        polyline: data.polyline || null,
        routeOptions: data.routeOptions || null,
        notes: data.notes || null,
      },
    });

    return segment as TravelSegment;
  }

  /**
   * Find a travel segment by its ID
   * @param id - Travel segment ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found TravelSegment or null if not found
   */
  async findById(id: string, prismaClient?: PrismaClient): Promise<TravelSegment | null> {
    const client = prismaClient || this.prisma;

    const segment = await client.travelSegment.findUnique({
      where: { id },
    });

    return segment as TravelSegment | null;
  }

  /**
   * Find all travel segments for a specific trip
   * @param tripId - Trip ID to search for segments
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns List of TravelSegments for the specified trip
   */
  async findByTripId(tripId: string, prismaClient?: PrismaClient): Promise<TravelSegment[]> {
    const client = prismaClient || this.prisma;

    const segments = await client.travelSegment.findMany({
      where: { tripId },
      orderBy: [
        { originStop: { order: 'asc' } },
      ],
    });

    return segments as TravelSegment[];
  }

  /**
   * Find travel segment by origin and destination stop IDs
   * @param originStopId - Origin stop ID
   * @param destinationStopId - Destination stop ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found TravelSegment or null if not found
   */
  async findByStops(
    originStopId: string,
    destinationStopId: string,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment | null> {
    const client = prismaClient || this.prisma;

    const segment = await client.travelSegment.findFirst({
      where: {
        originStopId,
        destinationStopId,
      },
    });

    return segment as TravelSegment | null;
  }

  /**
   * Search for travel segments based on criteria
   * @param criteria - Search criteria including tripId, originStopId, etc.
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns List of TravelSegments matching the criteria
   */
  async search(
    criteria: TravelSegmentSearchCriteria,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment[]> {
    const client = prismaClient || this.prisma;

    const where: any = {};
    
    if (criteria.tripId) {
      where.tripId = criteria.tripId;
    }
    
    if (criteria.originStopId) {
      where.originStopId = criteria.originStopId;
    }
    
    if (criteria.destinationStopId) {
      where.destinationStopId = criteria.destinationStopId;
    }
    
    if (criteria.travelMode) {
      where.travelMode = criteria.travelMode;
    }

    const segments = await client.travelSegment.findMany({
      where,
      orderBy: [
        { originStop: { order: 'asc' } },
      ],
    });

    return segments as TravelSegment[];
  }

  /**
   * Update an existing travel segment
   * @param id - Travel segment ID to update
   * @param data - Data to update the travel segment with
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated TravelSegment
   */
  async update(
    id: string,
    data: UpdateTravelSegmentRequest,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment> {
    const client = prismaClient || this.prisma;

    const updateData: any = {};
    
    if (data.travelMode !== undefined) {
      updateData.travelMode = data.travelMode;
    }
    if (data.distance !== undefined) {
      updateData.distance = data.distance;
    }
    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }
    if (data.apiCalculatedDistance !== undefined) {
      updateData.apiCalculatedDistance = data.apiCalculatedDistance;
    }
    if (data.apiCalculatedDuration !== undefined) {
      updateData.apiCalculatedDuration = data.apiCalculatedDuration;
    }
    if (data.polyline !== undefined) {
      updateData.polyline = data.polyline;
    }
    if (data.routeOptions !== undefined) {
      updateData.routeOptions = data.routeOptions;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const segment = await client.travelSegment.update({
      where: { id },
      data: updateData,
    });

    return segment as TravelSegment;
  }

  /**
   * Update only the notes field of a travel segment
   * @param id - Travel segment ID to update
   * @param notes - New notes value
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated TravelSegment
   */
  async updateNotes(id: string, notes: string, prismaClient?: PrismaClient): Promise<TravelSegment> {
    const client = prismaClient || this.prisma;

    const segment = await client.travelSegment.update({
      where: { id },
      data: { notes },
    });

    return segment as TravelSegment;
  }

  /**
   * Update API calculated data for a travel segment
   * @param id - Travel segment ID to update
   * @param apiCalculatedDistance - New API calculated distance
   * @param apiCalculatedDuration - New API calculated duration
   * @param polyline - New polyline data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated TravelSegment
   */
  async updateApiCalculatedData(
    id: string,
    apiCalculatedDistance?: number,
    apiCalculatedDuration?: number,
    polyline?: string,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment> {
    const client = prismaClient || this.prisma;

    const updateData: any = {};
    
    if (apiCalculatedDistance !== undefined) {
      updateData.apiCalculatedDistance = apiCalculatedDistance;
    }
    if (apiCalculatedDuration !== undefined) {
      updateData.apiCalculatedDuration = apiCalculatedDuration;
    }
    if (polyline !== undefined) {
      updateData.polyline = polyline;
    }

    const segment = await client.travelSegment.update({
      where: { id },
      data: updateData,
    });

    return segment as TravelSegment;
  }

  /**
   * Delete a travel segment by its ID
   * @param id - Travel segment ID to delete
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async delete(id: string, prismaClient?: PrismaClient): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.travelSegment.delete({
      where: { id },
    });
  }

  /**
   * Delete all travel segments for a specific trip
   * @param tripId - Trip ID to delete segments for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async deleteByTripId(tripId: string, prismaClient?: PrismaClient): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.travelSegment.deleteMany({
      where: { tripId },
    });
  }

  /**
   * Delete travel segment by origin stop ID (when stop is deleted)
   * @param originStopId - Origin stop ID to delete segments for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async deleteByOriginStopId(originStopId: string, prismaClient?: PrismaClient): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.travelSegment.deleteMany({
      where: { originStopId },
    });
  }

  /**
   * Delete travel segment by destination stop ID (when stop is deleted)
   * @param destinationStopId - Destination stop ID to delete segments for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async deleteByDestinationStopId(destinationStopId: string, prismaClient?: PrismaClient): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.travelSegment.deleteMany({
      where: { destinationStopId },
    });
  }

  /**
   * Get the total count of travel segments for a trip
   * @param tripId - Trip ID to count segments for
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns The total number of segments in the trip
   */
  async getSegmentCount(tripId: string, prismaClient?: PrismaClient): Promise<number> {
    const client = prismaClient || this.prisma;

    return await client.travelSegment.count({
      where: { tripId },
    });
  }

  /**
   * Check if a travel segment exists
   * @param id - Travel segment ID to check
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns True if segment exists, false otherwise
   */
  async exists(id: string, prismaClient?: PrismaClient): Promise<boolean> {
    const client = prismaClient || this.prisma;

    const count = await client.travelSegment.count({
      where: { id },
    });

    return count > 0;
  }
}
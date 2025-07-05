import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@trip-planner/prisma';
import {
  BulkTravelSegmentUpdateRequest,
  CreateTravelSegmentRequest,
  TravelSegment,
  TravelSegmentSearchCriteria,
  UpdateTravelSegmentRequest,
  UpdateTravelSegmentNotesRequest,
} from '@trip-planner/types';
import { TravelSegmentRepository } from './travel-segment.repository';

@Injectable()
export class TravelSegmentService {
  private readonly logger = new Logger(TravelSegmentService.name);

  constructor(private readonly travelSegmentRepository: TravelSegmentRepository) {}

  /**
   * Create a new travel segment for a trip.
   * @param data - Data for the new travel segment.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The created travel segment.
   */
  async create(data: CreateTravelSegmentRequest, prismaClient?: PrismaClient): Promise<TravelSegment> {
    // Validate numeric fields if provided
    if (data.distance !== undefined && data.distance !== null && data.distance < 0) {
      throw new BadRequestException('Distance must be non-negative');
    }

    if (data.duration !== undefined && data.duration !== null && data.duration < 0) {
      throw new BadRequestException('Duration must be non-negative');
    }

    if (data.apiCalculatedDistance !== undefined && data.apiCalculatedDistance !== null && data.apiCalculatedDistance < 0) {
      throw new BadRequestException('API calculated distance must be non-negative');
    }

    if (data.apiCalculatedDuration !== undefined && data.apiCalculatedDuration !== null && data.apiCalculatedDuration < 0) {
      throw new BadRequestException('API calculated duration must be non-negative');
    }

    // Check if segment already exists for these stops
    const existingSegment = await this.travelSegmentRepository.findByStops(
      data.originStopId,
      data.destinationStopId,
      prismaClient,
    );

    if (existingSegment) {
      throw new BadRequestException(
        `Travel segment already exists between stops ${data.originStopId} and ${data.destinationStopId}`,
      );
    }

    this.logger.debug(
      `Creating travel segment for trip ${data.tripId} from stop ${data.originStopId} to ${data.destinationStopId}`,
    );

    return await this.travelSegmentRepository.create(data, prismaClient);
  }

  /**
   * Find a travel segment by its ID.
   * @param id - Travel segment ID to search for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The travel segment.
   */
  async findById(id: string, prismaClient?: PrismaClient): Promise<TravelSegment> {
    const segment = await this.travelSegmentRepository.findById(id, prismaClient);

    if (!segment) {
      throw new NotFoundException(`Travel segment with ID ${id} not found`);
    }

    return segment;
  }

  /**
   * Find travel segments by trip ID.
   * @param tripId - Trip ID to search for segments.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of travel segments for the specified trip.
   */
  async findByTripId(tripId: string, prismaClient?: PrismaClient): Promise<TravelSegment[]> {
    return await this.travelSegmentRepository.findByTripId(tripId, prismaClient);
  }

  /**
   * Find travel segment by origin and destination stops.
   * @param originStopId - Origin stop ID.
   * @param destinationStopId - Destination stop ID.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The travel segment or null if not found.
   */
  async findByStops(
    originStopId: string,
    destinationStopId: string,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment | null> {
    return await this.travelSegmentRepository.findByStops(originStopId, destinationStopId, prismaClient);
  }

  /**
   * Search for travel segments based on criteria.
   * @param criteria - Search criteria including tripId, originStopId, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of travel segments matching the criteria.
   */
  async search(
    criteria: TravelSegmentSearchCriteria,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment[]> {
    return await this.travelSegmentRepository.search(criteria, prismaClient);
  }

  /**
   * Update an existing travel segment.
   * @param id - Travel segment ID to update.
   * @param data - Data to update the travel segment with.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async update(id: string, data: UpdateTravelSegmentRequest, prismaClient?: PrismaClient): Promise<TravelSegment> {
    // Validate numeric fields if provided
    if (data.distance !== undefined && data.distance !== null && data.distance < 0) {
      throw new BadRequestException('Distance must be non-negative');
    }

    if (data.duration !== undefined && data.duration !== null && data.duration < 0) {
      throw new BadRequestException('Duration must be non-negative');
    }

    if (data.apiCalculatedDistance !== undefined && data.apiCalculatedDistance !== null && data.apiCalculatedDistance < 0) {
      throw new BadRequestException('API calculated distance must be non-negative');
    }

    if (data.apiCalculatedDuration !== undefined && data.apiCalculatedDuration !== null && data.apiCalculatedDuration < 0) {
      throw new BadRequestException('API calculated duration must be non-negative');
    }

    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Updating travel segment ${id}`);

    return await this.travelSegmentRepository.update(id, data, prismaClient);
  }

  /**
   * Update only the notes field of a travel segment.
   * @param id - Travel segment ID to update.
   * @param data - Notes data to update.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async updateNotes(
    id: string,
    data: UpdateTravelSegmentNotesRequest,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment> {
    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Updating notes for travel segment ${id}`);

    return await this.travelSegmentRepository.updateNotes(id, data.notes || '', prismaClient);
  }

  /**
   * Update API calculated data for a travel segment.
   * @param id - Travel segment ID to update.
   * @param apiCalculatedDistance - New API calculated distance.
   * @param apiCalculatedDuration - New API calculated duration.
   * @param polyline - New polyline data.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async updateApiCalculatedData(
    id: string,
    apiCalculatedDistance?: number,
    apiCalculatedDuration?: number,
    polyline?: string,
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment> {
    // Validate numeric fields if provided
    if (apiCalculatedDistance !== undefined && apiCalculatedDistance !== null && apiCalculatedDistance < 0) {
      throw new BadRequestException('API calculated distance must be non-negative');
    }

    if (apiCalculatedDuration !== undefined && apiCalculatedDuration !== null && apiCalculatedDuration < 0) {
      throw new BadRequestException('API calculated duration must be non-negative');
    }

    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Updating API calculated data for travel segment ${id}`);

    return await this.travelSegmentRepository.updateApiCalculatedData(
      id,
      apiCalculatedDistance,
      apiCalculatedDuration,
      polyline,
      prismaClient,
    );
  }

  /**
   * Bulk update multiple travel segments for a trip.
   * @param request - Contains tripId and array of segment updates.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of updated travel segments.
   */
  async bulkUpdate(request: BulkTravelSegmentUpdateRequest, prismaClient?: PrismaClient): Promise<TravelSegment[]> {
    const { tripId, updates } = request;

    if (updates.length === 0) {
      throw new BadRequestException('Updates array cannot be empty');
    }

    // Validate all updates
    for (const update of updates) {
      if (update.distance !== undefined && update.distance !== null && update.distance < 0) {
        throw new BadRequestException(`Distance must be non-negative for segment ${update.id}`);
      }
      if (update.duration !== undefined && update.duration !== null && update.duration < 0) {
        throw new BadRequestException(`Duration must be non-negative for segment ${update.id}`);
      }
      if (update.apiCalculatedDistance !== undefined && update.apiCalculatedDistance !== null && update.apiCalculatedDistance < 0) {
        throw new BadRequestException(`API calculated distance must be non-negative for segment ${update.id}`);
      }
      if (update.apiCalculatedDuration !== undefined && update.apiCalculatedDuration !== null && update.apiCalculatedDuration < 0) {
        throw new BadRequestException(`API calculated duration must be non-negative for segment ${update.id}`);
      }
    }

    // Verify all segments exist and belong to the trip
    const existingSegments = await this.travelSegmentRepository.findByTripId(tripId, prismaClient);
    const existingSegmentIds = existingSegments.map(segment => segment.id);

    const invalidIds = updates.map(update => update.id).filter(id => !existingSegmentIds.includes(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid travel segment IDs: ${invalidIds.join(', ')}`);
    }

    this.logger.debug(`Bulk updating ${updates.length} travel segments for trip ${tripId}`);

    const updatedSegments: TravelSegment[] = [];

    for (const update of updates) {
      const { id, ...updateData } = update;
      const updatedSegment = await this.travelSegmentRepository.update(id, updateData, prismaClient);
      updatedSegments.push(updatedSegment);
    }

    return updatedSegments;
  }

  /**
   * Delete a travel segment by its ID.
   * @param id - Travel segment ID to delete.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(id: string, prismaClient?: PrismaClient): Promise<void> {
    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Deleting travel segment ${id}`);

    await this.travelSegmentRepository.delete(id, prismaClient);
  }

  /**
   * Delete all travel segments for a specific trip.
   * @param tripId - Trip ID to delete segments for.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async deleteByTripId(tripId: string, prismaClient?: PrismaClient): Promise<void> {
    this.logger.debug(`Deleting all travel segments for trip ${tripId}`);

    await this.travelSegmentRepository.deleteByTripId(tripId, prismaClient);
  }

  /**
   * Delete travel segments associated with a stop (when stop is deleted).
   * @param stopId - Stop ID to delete segments for.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async deleteByStopId(stopId: string, prismaClient?: PrismaClient): Promise<void> {
    this.logger.debug(`Deleting travel segments associated with stop ${stopId}`);

    // Delete segments where this stop is the origin
    await this.travelSegmentRepository.deleteByOriginStopId(stopId, prismaClient);

    // Delete segments where this stop is the destination
    await this.travelSegmentRepository.deleteByDestinationStopId(stopId, prismaClient);
  }

  /**
   * Get the total number of travel segments for a trip.
   * @param tripId - Trip ID to count segments for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The total number of segments in the trip.
   */
  async getSegmentCount(tripId: string, prismaClient?: PrismaClient): Promise<number> {
    return await this.travelSegmentRepository.getSegmentCount(tripId, prismaClient);
  }

  /**
   * Validate if a travel segment exists by ID.
   * @param id - Travel segment ID to check.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the segment exists, false if not found.
   */
  async validateSegmentExists(id: string, prismaClient?: PrismaClient): Promise<boolean> {
    try {
      await this.findById(id, prismaClient);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Validate if a travel segment belongs to a specific trip.
   * @param segmentId - Travel segment ID to check.
   * @param tripId - Trip ID to validate against.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the segment belongs to the trip, false otherwise.
   */
  async validateSegmentBelongsToTrip(
    segmentId: string,
    tripId: string,
    prismaClient?: PrismaClient,
  ): Promise<boolean> {
    const segment = await this.travelSegmentRepository.findById(segmentId, prismaClient);
    return segment?.tripId === tripId;
  }

  /**
   * Create travel segments between consecutive stops in a trip.
   * This is a utility method for when stops are reordered or new stops are added.
   * @param tripId - Trip ID to create segments for.
   * @param stopIds - Array of stop IDs in order.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Array of created travel segments.
   */
  async createSegmentsBetweenStops(
    tripId: string,
    stopIds: string[],
    prismaClient?: PrismaClient,
  ): Promise<TravelSegment[]> {
    if (stopIds.length < 2) {
      return [];
    }

    const segments: TravelSegment[] = [];

    for (let i = 0; i < stopIds.length - 1; i++) {
      const originStopId = stopIds[i];
      const destinationStopId = stopIds[i + 1];

      // Check if segment already exists
      const existingSegment = await this.travelSegmentRepository.findByStops(
        originStopId,
        destinationStopId,
        prismaClient,
      );

      if (!existingSegment) {
        const segmentData: CreateTravelSegmentRequest = {
          tripId,
          originStopId,
          destinationStopId,
        };

        const newSegment = await this.travelSegmentRepository.create(segmentData, prismaClient);
        segments.push(newSegment);
      } else {
        segments.push(existingSegment);
      }
    }

    return segments;
  }
}
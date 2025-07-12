import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  BulkTravelSegmentUpdateRequest,
  BulkTravelSegmentUpdateSchema,
  CreateTravelSegmentRequest,
  CreateTravelSegmentSchema,
  TravelSegment,
  TravelSegmentWithStops,
  TravelSegmentSearchCriteria,
  TravelSegmentSearchSchema,
  UpdateTravelSegmentRequest,
  UpdateTravelSegmentSchema,
  UpdateTravelSegmentNotesRequest,
  UpdateTravelSegmentNotesSchema,
  UpdateTravelSegmentRoutingData,
  UpdateTravelSegmentRoutingDataSchema,
  UpdateTravelApiCalculatedDataSchema,
  UpdateTravelApiCalculatedData,
  Stop,
  SegmentRoutingData,
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
  async create(
    data: CreateTravelSegmentRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment> {
    const validatedData = CreateTravelSegmentSchema.parse(data);

    // Check if segment already exists for these stops
    const existingSegment = await this.travelSegmentRepository.findByStops(
      validatedData.originStopId,
      validatedData.destinationStopId,
      prismaClient,
    );

    if (existingSegment) {
      throw new BadRequestException(
        `Travel segment already exists between stops ${validatedData.originStopId} and ${validatedData.destinationStopId}`,
      );
    }

    this.logger.debug(
      `Creating travel segment for trip ${validatedData.tripId} from stop ${validatedData.originStopId} to ${validatedData.destinationStopId}`,
    );

    return await this.travelSegmentRepository.create(validatedData, prismaClient);
  }

  /**
   * Find a travel segment by its ID.
   * @param id - Travel segment ID to search for.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The travel segment.
   */
  async findById(id: string, prismaClient?: PrismaClientOrTransaction): Promise<TravelSegment> {
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
  async findByTripId(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment[]> {
    return await this.travelSegmentRepository.findByTripId(tripId, prismaClient);
  }

  /**
   * Find travel segment by origin and destination stops.
   * @param originStopId - Origin stop ID.
   * @param destinationStopId - Destination stop ID.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return The travel segment with stop locations or null if not found.
   */
  async findByStops(
    originStopId: string,
    destinationStopId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegmentWithStops | null> {
    return await this.travelSegmentRepository.findByStops(
      originStopId,
      destinationStopId,
      prismaClient,
    );
  }

  /**
   * Search for travel segments based on criteria.
   * @param criteria - Search criteria including tripId, originStopId, etc.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of travel segments matching the criteria.
   */
  async search(
    criteria: TravelSegmentSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment[]> {
    const validatedCriteria = TravelSegmentSearchSchema.parse(criteria);
    return await this.travelSegmentRepository.search(validatedCriteria, prismaClient);
  }

  /**
   * Update an existing travel segment.
   * @param id - Travel segment ID to update.
   * @param data - Data to update the travel segment with.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async update(
    id: string,
    data: UpdateTravelSegmentRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment> {
    const validatedData = UpdateTravelSegmentSchema.parse(data);

    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Updating travel segment ${id}`);

    return await this.travelSegmentRepository.update(id, validatedData, prismaClient);
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
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment> {
    const validatedData = UpdateTravelSegmentNotesSchema.parse(data);

    // Verify segment exists
    await this.findById(id, prismaClient);

    this.logger.debug(`Updating notes for travel segment ${id}`);

    return await this.travelSegmentRepository.updateNotes(
      id,
      validatedData.notes || '',
      prismaClient,
    );
  }

  /**
   * Update API calculated data for a travel segment.
   * @param data - Data containing API calculated id, distance, duration, and polyline.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async updateApiCalculatedData(
    data: UpdateTravelApiCalculatedData,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment> {
    // Validate the update data using schema
    const updateData = UpdateTravelApiCalculatedDataSchema.parse(data);

    // Verify segment exists
    await this.findById(data.id, prismaClient);

    this.logger.debug(`Updating API calculated data for travel segment ${data.id}`);

    return await this.travelSegmentRepository.updateApiCalculatedData(updateData, prismaClient);
  }

  /**
   * Update travel segment with routing data from routing service.
   * @param id - Travel segment ID to update.
   * @param routingData - Routing data with proper typing.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return Updated travel segment.
   */
  async updateWithRoutingData(
    id: string,
    routingData: UpdateTravelSegmentRoutingData,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment> {
    const validatedRoutingData = UpdateTravelSegmentRoutingDataSchema.parse(routingData);

    this.logger.debug(
      `Updating travel segment ${id} with routing data from ${validatedRoutingData.provider}`,
    );

    // Update the segment with routing data - note we need to map the field names
    const updateData: UpdateTravelSegmentRequest = {
      travelMode: validatedRoutingData.travelMode,
      apiCalculatedDistance: validatedRoutingData.distanceMeters,
      apiCalculatedDuration: Math.round(validatedRoutingData.durationSeconds / 60), // Convert seconds to minutes and round to integer - change later
      polyline: validatedRoutingData.polyline,
      // Note: provider is not stored directly on the segment, could be stored in routeOptions
      routeOptions: { provider: validatedRoutingData.provider },
    };

    return await this.update(id, updateData, prismaClient);
  }

  /**
   * Bulk update multiple travel segments for a trip.
   * @param request - Contains tripId and array of segment updates.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return List of updated travel segments.
   */
  async bulkUpdate(
    request: BulkTravelSegmentUpdateRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TravelSegment[]> {
    const validatedRequest = BulkTravelSegmentUpdateSchema.parse(request);
    const { tripId, updates } = validatedRequest;

    // Verify all segments exist and belong to the trip
    const existingSegments = await this.travelSegmentRepository.findByTripId(tripId, prismaClient);
    const existingSegmentIds = existingSegments.map(segment => segment.id);

    const invalidIds = updates
      .map(update => update.id)
      .filter((id): id is string => id !== undefined && !existingSegmentIds.includes(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid travel segment IDs: ${invalidIds.join(', ')}`);
    }

    this.logger.debug(`Bulk updating ${updates.length} travel segments for trip ${tripId}`);

    const updatedSegments: TravelSegment[] = [];

    for (const update of updates) {
      const { id, ...updateData } = update;
      if (!id) {
        throw new BadRequestException('Travel segment ID is required for updates');
      }
      const updatedSegment = await this.travelSegmentRepository.update(
        id,
        updateData,
        prismaClient,
      );
      updatedSegments.push(updatedSegment);
    }

    return updatedSegments;
  }

  /**
   * Delete a travel segment by its ID.
   * @param id - Travel segment ID to delete.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
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
  async deleteByTripId(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    this.logger.debug(`Deleting all travel segments for trip ${tripId}`);

    await this.travelSegmentRepository.deleteByTripId(tripId, prismaClient);
  }

  /**
   * Delete travel segments associated with a stop (when stop is deleted).
   * @param stopId - Stop ID to delete segments for.
   * @param prismaClient - Optional Prisma client for transaction management.
   */
  async deleteByStopId(stopId: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
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
  async getSegmentCount(tripId: string, prismaClient?: PrismaClientOrTransaction): Promise<number> {
    return await this.travelSegmentRepository.getSegmentCount(tripId, prismaClient);
  }

  /**
   * Validate if a travel segment exists by ID.
   * @param id - Travel segment ID to check.
   * @param prismaClient - Optional Prisma client for transaction management.
   * @return True if the segment exists, false if not found.
   */
  async validateSegmentExists(
    id: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
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
    prismaClient?: PrismaClientOrTransaction,
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
    prismaClient?: PrismaClientOrTransaction,
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

  /**
   * Batch create travel segments with pre-calculated routing data.
   * Reduces N-1 segment operations to 1 operation.
   * @param tripId - Trip ID for the segments.
   * @param stops - Created stops in order.
   * @param routingUpdates - Pre-calculated routing data (empty if calculateRouting=false).
   * @param prismaClient - Prisma client for transaction.
   */
  async batchCreateTravelSegments(
    tripId: string,
    stops: Stop[],
    routingUpdates: SegmentRoutingData[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    if (stops.length < 2) {
      return;
    }

    // Create routing map for efficient lookups
    const routingMap = new Map(
      routingUpdates.map(r => [`${r.originStopId}-${r.destinationStopId}`, r]),
    );

    // Sort stops by order to ensure correct sequence
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    // Build segment creation data
    const segmentCreateData = [];
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originStop = sortedStops[i];
      const destinationStop = sortedStops[i + 1];
      const segmentKey = `${originStop.id}-${destinationStop.id}`;
      const routingData = routingMap.get(segmentKey);

      const segmentData = {
        tripId,
        originStopId: originStop.id as string,
        destinationStopId: destinationStop.id as string,
        travelMode: routingData?.travelMode || undefined,
        distance: undefined, // User can set this manually later
        duration: undefined, // User can set this manually later
        apiCalculatedDistance: routingData?.apiCalculatedDistance || undefined,
        apiCalculatedDuration: routingData?.apiCalculatedDuration || undefined,
        polyline: routingData?.polyline || undefined,
        routeOptions: undefined,
        notes: undefined,
      };

      segmentCreateData.push(segmentData);
    }

    // Batch create all segments
    await prismaClient.travelSegment.createMany({
      data: segmentCreateData,
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { StopService } from '@trip-planner/stop';
import { TimelineService } from '@trip-planner/timeline';
import { TimelineCalculationRequest, Trip } from '@trip-planner/types';

@Injectable()
export class TimelineCoordinationService {
  private readonly logger = new Logger(TimelineCoordinationService.name);

  constructor(
    private readonly tripService: TripService,
    private readonly stopService: StopService,
    private readonly timelineService: TimelineService,
  ) {}

  /**
   * Check if timeline recalculation is needed for a trip.
   * @param trip - Trip object to check.
   * @return True if timeline recalculation is needed.
   */
  isTimelineRecalculationNeeded(trip: Trip): boolean {
    // Check dirty flag first
    if (trip.needsTimelineRecalculation) {
      return true;
    }

    // Fallback: Check if any stops are missing calculated times
    if (!trip.stops || trip.stops.length === 0) {
      return false;
    }

    for (const stop of trip.stops) {
      if (!stop.calculatedArrivalTime || !stop.calculatedDepartureTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Recalculate timeline and update database with results.
   * @param tripId - Trip ID to recalculate.
   * @param prismaClient - Prisma client for transaction.
   * @param forceRecalculate - Whether to force recalculation regardless of current state.
   */
  async recalculateAndUpdateTimeline(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
    forceRecalculate = false,
  ): Promise<void> {
    // Get current trip data
    const trip = await this.tripService.findById(tripId, true, false, true, prismaClient);

    if (!trip.stops || trip.stops.length === 0) {
      this.logger.debug(`No stops found for trip ${tripId}, skipping timeline calculation`);
      return;
    }

    // Check if timeline recalculation is needed
    if (!forceRecalculate && !this.isTimelineRecalculationNeeded(trip)) {
      this.logger.debug(`Timeline recalculation not needed for trip ${tripId}`);
      return;
    }

    // Prepare timeline calculation request
    const timelineRequest: TimelineCalculationRequest = {
      stops: trip.stops,
      segments: trip.travelSegments || [],
      startTime: trip.startDate || undefined,
    };

    // Calculate timeline
    const result = this.timelineService.calculateSequentialTimeline(timelineRequest);

    // Update stops with calculated times
    for (const updatedStop of result.updatedStops) {
      await this.stopService.updateCalculatedTimes(
        updatedStop.id as string,
        updatedStop.calculatedArrivalTime ?? undefined,
        updatedStop.calculatedDepartureTime ?? undefined,
        prismaClient,
      );
    }

    // Clear the dirty flag after successful recalculation
    await this.tripService.updateTimelineRecalculationFlag(tripId, false, prismaClient);

    this.logger.debug(
      `Updated timeline for trip ${tripId}: ${result.totalTripDuration} minutes total`,
    );
  }

  /**
   * Set the timeline recalculation flag for a trip.
   * @param tripId - Trip ID to update.
   * @param needsRecalculation - Whether timeline recalculation is needed.
   * @param prismaClient - Prisma client for transaction.
   */
  async setTimelineRecalculationFlag(
    tripId: string,
    needsRecalculation: boolean,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<void> {
    await this.tripService.updateTimelineRecalculationFlag(
      tripId,
      needsRecalculation,
      prismaClient,
    );
  }

  /**
   * Validate and recalculate timeline if needed.
   * @param tripId - Trip ID to validate and recalculate.
   * @param prismaClient - Prisma client for transaction.
   * @return True if timeline was recalculated.
   */
  async validateAndRecalculateTimeline(
    tripId: string,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<boolean> {
    const trip = await this.tripService.findById(tripId, true, false, true, prismaClient);

    if (!trip.stops || trip.stops.length === 0) {
      this.logger.debug(`No stops found for trip ${tripId}, skipping timeline validation`);
      return false;
    }

    if (this.isTimelineRecalculationNeeded(trip)) {
      await this.recalculateAndUpdateTimeline(tripId, prismaClient);
      return true;
    }

    return false;
  }
}

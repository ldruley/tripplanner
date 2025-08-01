import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { StopService } from '@trip-planner/stop';
import { TimelineService } from '@trip-planner/timeline';
import { SharedValidationService } from './shared-validation.service';
import {
  TimelineCalculationRequest,
  Trip,
  Stop,
  SegmentRoutingData,
  ComprehensiveStopUpdate,
  TimelineWithRoutingRequest,
  TimelineWithRoutingResult,
} from '@trip-planner/types';

export interface TimelineCoordinationRequest {
  stops: Stop[];
  routingData: SegmentRoutingData[];
  stopOrderChanges?: { stopId: string; newOrder: number }[];
  startTime?: Date;
  preserveUserTimings?: boolean;
  validateConsistency?: boolean;
}

export interface TimelineCoordinationResult {
  stopUpdates: ComprehensiveStopUpdate[];
  totalTripDuration: number;
  tripStartTime?: Date;
  tripEndTime?: Date;
  hasConflicts: boolean;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  metadata: {
    calculationTime: number;
    stopsProcessed: number;
    segmentsUsed: number;
    timelineMethod: 'routing' | 'sequential' | 'hybrid';
  };
}

@Injectable()
export class TimelineCoordinationService {
  private readonly logger = new Logger(TimelineCoordinationService.name);

  constructor(
    private readonly tripService: TripService,
    private readonly stopService: StopService,
    private readonly timelineService: TimelineService,
    private readonly sharedValidationService: SharedValidationService,
  ) {}

  /**
   * Comprehensive timeline coordination with routing data integration.
   * Orchestrates timeline calculation with validation and error handling.
   */
  async coordinateTimeline(
    request: TimelineCoordinationRequest,
  ): Promise<TimelineCoordinationResult> {
    const startTime = Date.now();

    this.logger.debug(
      `Coordinating timeline for ${request.stops.length} stops with ${request.routingData.length} routing entries`,
    );

    const validation = this.validateTimelineRequest(request);
    if (!validation.isValid) {
      return this.createErrorResult(validation.errors, startTime);
    }

    const timelineMethod = this.determineTimelineMethod(request);

    let timelineResult: TimelineWithRoutingResult;

    try {
      if (timelineMethod === 'routing' && request.routingData.length > 0) {
        timelineResult = await this.calculateTimelineWithRouting(request);
      } else {
        timelineResult = await this.calculateSequentialTimeline(request);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown timeline calculation error';
      return this.createErrorResult([`Timeline calculation failed: ${errorMessage}`], startTime);
    }

    const processedResult = await this.postProcessTimelineResult(timelineResult, request);

    const additionalValidation = request.validateConsistency
      ? this.validateTimelineConsistency(processedResult.stopUpdates, request.stops)
      : { isValid: true, errors: [], warnings: [] };

    const calculationTime = Date.now() - startTime;

    this.logger.log(
      `Timeline coordination completed in ${calculationTime}ms: ${processedResult.stopUpdates.length} stop updates using ${timelineMethod} method`,
    );

    return {
      stopUpdates: processedResult.stopUpdates,
      totalTripDuration: processedResult.totalTripDuration,
      tripStartTime: processedResult.tripStartTime,
      tripEndTime: processedResult.tripEndTime,
      hasConflicts: processedResult.hasConflicts,
      validation: {
        isValid: validation.isValid && additionalValidation.isValid,
        errors: [...validation.errors, ...additionalValidation.errors],
        warnings: [...validation.warnings, ...additionalValidation.warnings],
      },
      metadata: {
        calculationTime,
        stopsProcessed: request.stops.length,
        segmentsUsed: request.routingData.length,
        timelineMethod,
      },
    };
  }

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
    const trip = await this.tripService.findById(tripId, { includeStops: true, includeTravelSegments: true }, prismaClient);

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
    const trip = await this.tripService.findById(tripId, { includeStops: true, includeTravelSegments: true }, prismaClient);

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

  // New comprehensive timeline coordination methods below

  private async calculateTimelineWithRouting(
    request: TimelineCoordinationRequest,
  ): Promise<TimelineWithRoutingResult> {
    const timelineRequest: TimelineWithRoutingRequest = {
      stops: request.stops,
      routingData: request.routingData,
      stopOrderChanges: request.stopOrderChanges || [],
      startTime: request.startTime,
    };

    return this.timelineService.calculateTimelineWithRouting(timelineRequest);
  }

  private async calculateSequentialTimeline(
    request: TimelineCoordinationRequest,
  ): Promise<TimelineWithRoutingResult> {
    const virtualSegments = request.routingData.map(routing => ({
      id: `virtual-${routing.originStopId}-${routing.destinationStopId}`,
      tripId: 'virtual',
      originStopId: routing.originStopId,
      destinationStopId: routing.destinationStopId,
      travelMode: routing.travelMode,
      distance: null,
      duration: null,
      apiCalculatedDistance: routing.apiCalculatedDistance,
      apiCalculatedDuration: routing.apiCalculatedDuration,
      polyline: routing.polyline,
      routeOptions: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const sequentialResult = this.timelineService.calculateSequentialTimeline({
      stops: request.stops,
      segments: virtualSegments,
      startTime: request.startTime,
    });

    const stopUpdates: ComprehensiveStopUpdate[] = sequentialResult.updatedStops.map(stop => ({
      id: stop.id as string,
      calculatedArrivalTime: stop.calculatedArrivalTime ?? undefined,
      calculatedDepartureTime: stop.calculatedDepartureTime ?? undefined,
    }));

    if (request.stopOrderChanges) {
      const orderMap = new Map(
        request.stopOrderChanges.map(change => [change.stopId, change.newOrder]),
      );
      for (const update of stopUpdates) {
        const newOrder = orderMap.get(update.id);
        if (newOrder !== undefined) {
          update.order = newOrder;
        }
      }
    }

    return {
      stopUpdates,
      totalTripDuration: sequentialResult.totalTripDuration,
      tripStartTime: sequentialResult.tripStartTime,
      tripEndTime: sequentialResult.tripEndTime,
      hasConflicts: sequentialResult.hasConflicts,
    };
  }

  private determineTimelineMethod(
    request: TimelineCoordinationRequest,
  ): 'routing' | 'sequential' | 'hybrid' {
    if (request.routingData.length > 0) {
      const routingValidation = this.timelineService.validateRoutingDataCompleteness(
        request.stops,
        request.routingData,
      );

      if (routingValidation.isComplete) {
        return 'routing';
      }
    }

    return 'sequential';
  }

  private async postProcessTimelineResult(
    timelineResult: TimelineWithRoutingResult,
    request: TimelineCoordinationRequest,
  ): Promise<TimelineWithRoutingResult> {
    let processedStopUpdates = [...timelineResult.stopUpdates];

    if (request.preserveUserTimings) {
      processedStopUpdates = this.preserveUserTimings(processedStopUpdates, request.stops);
    }

    if (request.stopOrderChanges && request.stopOrderChanges.length > 0) {
      processedStopUpdates = this.ensureOrderConsistency(
        processedStopUpdates,
        request.stopOrderChanges,
      );
    }

    return {
      ...timelineResult,
      stopUpdates: processedStopUpdates,
    };
  }

  private preserveUserTimings(
    stopUpdates: ComprehensiveStopUpdate[],
    originalStops: Stop[],
  ): ComprehensiveStopUpdate[] {
    const originalStopMap = new Map(originalStops.map(stop => [stop.id as string, stop]));

    return stopUpdates.map(update => {
      const originalStop = originalStopMap.get(update.id);
      if (originalStop) {
        if (originalStop.plannedArrivalTime) {
          update.calculatedArrivalTime = originalStop.plannedArrivalTime;
        }

        if (originalStop.plannedDuration && update.calculatedArrivalTime) {
          update.calculatedDepartureTime = new Date(
            update.calculatedArrivalTime.getTime() + originalStop.plannedDuration * 1000,
          );
        }
      }
      return update;
    });
  }

  private ensureOrderConsistency(
    stopUpdates: ComprehensiveStopUpdate[],
    orderChanges: { stopId: string; newOrder: number }[],
  ): ComprehensiveStopUpdate[] {
    const orderMap = new Map(orderChanges.map(change => [change.stopId, change.newOrder]));

    return stopUpdates
      .map(update => {
        const newOrder = orderMap.get(update.id);
        if (newOrder !== undefined) {
          return { ...update, order: newOrder };
        }
        return update;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  private validateTimelineRequest(request: TimelineCoordinationRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.stops || request.stops.length === 0) {
      errors.push('Stops are required for timeline calculation');
    }

    if (request.stops && request.stops.length === 1) {
      warnings.push('Single stop timeline calculation has limited usefulness');
    }

    if (request.routingData && request.routingData.length > 0) {
      const routingValidation = this.timelineService.validateRoutingDataCompleteness(
        request.stops || [],
        request.routingData,
      );

      if (!routingValidation.isComplete) {
        warnings.push(
          `Incomplete routing data: missing ${routingValidation.missingSegments.length} segments`,
        );
      }
    }

    if (request.stopOrderChanges && request.stopOrderChanges.length > 0) {
      const orderValidation = this.sharedValidationService.validateStopOrders(
        request.stopOrderChanges,
      );
      if (!orderValidation.isValid) {
        errors.push(...orderValidation.errors);
      }
    }

    if (request.startTime && request.startTime < new Date('1900-01-01')) {
      errors.push('Start time must be a valid date');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateTimelineConsistency(
    stopUpdates: ComprehensiveStopUpdate[],
    originalStops: Stop[],
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sortedUpdates = [...stopUpdates].sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < sortedUpdates.length; i++) {
      const update = sortedUpdates[i];

      if (update.calculatedArrivalTime && update.calculatedDepartureTime) {
        if (update.calculatedArrivalTime >= update.calculatedDepartureTime) {
          errors.push(`Stop ${update.id}: arrival time must be before departure time`);
        }
      }

      if (i < sortedUpdates.length - 1) {
        const nextUpdate = sortedUpdates[i + 1];
        if (update.calculatedDepartureTime && nextUpdate.calculatedArrivalTime) {
          if (update.calculatedDepartureTime > nextUpdate.calculatedArrivalTime) {
            errors.push(`Stop ${update.id}: departure time after next stop's arrival time`);
          }
        }
      }

      if (update.calculatedArrivalTime && update.calculatedDepartureTime) {
        const duration =
          update.calculatedDepartureTime.getTime() - update.calculatedArrivalTime.getTime();
        const durationMinutes = duration / (1000 * 60);

        if (durationMinutes < 0) {
          errors.push(`Stop ${update.id}: negative duration calculated`);
        } else if (durationMinutes > 1440) {
          warnings.push(
            `Stop ${update.id}: very long duration (${Math.round(durationMinutes)} minutes)`,
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private createErrorResult(errors: string[], startTime: number): TimelineCoordinationResult {
    return {
      stopUpdates: [],
      totalTripDuration: 0,
      hasConflicts: false,
      validation: {
        isValid: false,
        errors,
        warnings: [],
      },
      metadata: {
        calculationTime: Date.now() - startTime,
        stopsProcessed: 0,
        segmentsUsed: 0,
        timelineMethod: 'sequential',
      },
    };
  }
}

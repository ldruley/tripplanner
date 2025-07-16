import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Stop,
  TravelSegment,
  TimelineCalculationRequest,
  TimelineCalculationResult,
  TimelineCalculationRequestSchema,
  SegmentRoutingData,
  ComprehensiveStopUpdate,
  TimelineWithRoutingRequest,
  TimelineWithRoutingResult,
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';
import { DEFAULT_DURATIONS } from './timeline.types';

@Injectable()
export class TimelineService {
  /**
   * Calculate sequential timeline through stops without optimization
   * Respects user-defined durations absolutely
   */
  calculateSequentialTimeline(request: TimelineCalculationRequest): TimelineCalculationResult {
    TimelineCalculationRequestSchema.parse(request);
    const { stops, segments, startTime } = request;

    if (!stops || stops.length === 0) {
      return {
        updatedStops: [],
        totalTripDuration: 0,
        hasConflicts: false,
      };
    }

    // Sort stops by order to ensure proper sequence
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const updatedStops: Stop[] = [];

    let currentTime =
      startTime ||
      (sortedStops[0].plannedArrivalTime
        ? new Date(sortedStops[0].plannedArrivalTime)
        : new Date());
    let totalDuration = 0;

    for (let i = 0; i < sortedStops.length; i++) {
      const stop = { ...sortedStops[i] };

      // Calculate arrival time
      stop.calculatedArrivalTime = new Date(currentTime);

      // Use user-defined duration or suggest default (never override)
      const stopDuration =
        stop.plannedDuration || this.getDefaultStopDuration(stop.stopType || null);

      // Calculate departure time
      stop.calculatedDepartureTime = new Date(currentTime.getTime() + stopDuration * 60000);

      updatedStops.push(stop);
      totalDuration += stopDuration;

      // Move to next stop's arrival time
      if (i < sortedStops.length - 1) {
        const segment = segments.find(
          s => s.originStopId === stop.id && s.destinationStopId === sortedStops[i + 1].id,
        );

        const travelDuration = segment?.apiCalculatedDuration || segment?.duration || 0;
        currentTime = new Date(stop.calculatedDepartureTime.getTime() + travelDuration * 60000);
        totalDuration += travelDuration;
      }
    }

    return {
      updatedStops,
      totalTripDuration: totalDuration,
      tripStartTime: updatedStops[0]?.calculatedArrivalTime || undefined,
      tripEndTime: updatedStops[updatedStops.length - 1]?.calculatedDepartureTime || undefined,
      hasConflicts: false, // Basic implementation - no conflict detection yet
    };
  }

  /**
   * Calculate total trip duration including stops and travel time
   */
  calculateTripDuration(stops: Stop[], segments: TravelSegment[]): number {
    let totalDuration = 0;

    // Sum stop durations
    for (const stop of stops) {
      const stopDuration =
        stop.plannedDuration || this.getDefaultStopDuration(stop.stopType || null);
      totalDuration += stopDuration;
    }

    // Sum travel durations
    for (const segment of segments) {
      const travelDuration = segment.apiCalculatedDuration || segment.duration || 0;
      totalDuration += travelDuration;
    }

    return totalDuration;
  }

  /**
   * Get default duration for stop type (suggestion only - never overrides user input)
   */
  getDefaultStopDuration(stopType: string | null): number {
    if (stopType === 'PITSTOP') return DEFAULT_DURATIONS.PITSTOP;
    if (stopType === 'OVERNIGHT') return DEFAULT_DURATIONS.OVERNIGHT;
    return DEFAULT_DURATIONS.null;
  }

  /**
   * Basic schedule validation for impossible timing
   * Full validation is done with 'validateSchedule'
   */
  validateBasicSchedule(stops: Stop[]): boolean {
    // Basic validation - ensure no negative durations
    for (const stop of stops) {
      if (
        stop.plannedDuration !== null &&
        stop.plannedDuration !== undefined &&
        stop.plannedDuration < 0
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Propagate time changes through downstream stops
   */
  propagateTimeChanges(stops: Stop[], segments: TravelSegment[], changedStopIndex: number): Stop[] {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    // Only update stops after the changed one
    for (let i = changedStopIndex + 1; i < sortedStops.length; i++) {
      const previousStop = sortedStops[i - 1];
      const segment = segments.find(
        s => s.originStopId === previousStop.id && s.destinationStopId === sortedStops[i].id,
      );

      if (previousStop.calculatedDepartureTime) {
        const travelDuration = segment?.apiCalculatedDuration || segment?.duration || 0;
        sortedStops[i].calculatedArrivalTime = new Date(
          previousStop.calculatedDepartureTime.getTime() + travelDuration * 60000,
        );

        const stopDuration =
          sortedStops[i].plannedDuration ||
          this.getDefaultStopDuration(sortedStops[i].stopType || null);
        if (sortedStops[i].calculatedArrivalTime) {
          sortedStops[i].calculatedDepartureTime = new Date(
            sortedStops[i].calculatedArrivalTime!.getTime() + stopDuration * 60000,
          );
        }
      }
    }

    return sortedStops;
  }

  /**
   * Calculate complete timeline with routing data and stop reordering.
   * This method enables true batching by working with in-memory data structures.
   *
   * @param request - Contains stops, routing data, and optional reordering
   * @return Timeline calculation result with comprehensive stop updates
   */
  calculateTimelineWithRouting(request: TimelineWithRoutingRequest): TimelineWithRoutingResult {
    const { stops, routingData, stopOrderChanges = [], startTime } = request;

    if (!stops || stops.length === 0) {
      return {
        stopUpdates: [],
        totalTripDuration: 0,
        hasConflicts: false,
      };
    }

    // Step 1: Apply reordering to create new stop sequence
    const reorderedStops = this.applyStopReordering(stops, stopOrderChanges);

    // Step 2: Create virtual travel segments from routing data
    const virtualSegments = this.createVirtualSegments(routingData);

    // Step 3: Calculate timeline using reordered stops and routing data
    const timelineResult = this.calculateSequentialTimelineWithVirtualSegments(
      reorderedStops,
      virtualSegments,
      startTime,
    );

    // Step 4: Convert timeline result to comprehensive stop updates
    const stopUpdates = this.createComprehensiveStopUpdates(
      timelineResult.updatedStops,
      stopOrderChanges,
    );

    return {
      stopUpdates,
      totalTripDuration: timelineResult.totalTripDuration,
      tripStartTime: timelineResult.tripStartTime,
      tripEndTime: timelineResult.tripEndTime,
      hasConflicts: timelineResult.hasConflicts,
    };
  }

  /**
   * Apply stop reordering to create new sequence with updated orders.
   * Pure function - works with in-memory data.
   */
  private applyStopReordering(
    stops: Stop[],
    stopOrderChanges: { stopId: string; newOrder: number }[],
  ): Stop[] {
    if (stopOrderChanges.length === 0) {
      return [...stops].sort((a, b) => a.order - b.order);
    }

    // Create map of new orders
    const orderMap = new Map(stopOrderChanges.map(change => [change.stopId, change.newOrder]));

    // Apply new orders and sort
    const reorderedStops = stops.map(stop => ({
      ...stop,
      order: orderMap.get(stop.id as string) ?? stop.order,
    }));

    return reorderedStops.sort((a, b) => a.order - b.order);
  }

  /**
   * Create virtual travel segments from routing data for timeline calculation.
   * Pure function - converts routing data to segment format.
   */
  private createVirtualSegments(routingData: SegmentRoutingData[]): TravelSegment[] {
    return routingData.map(routing => ({
      id: randomUUID(),
      tripId: randomUUID(),
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
  }

  /**
   * Calculate sequential timeline using reordered stops and virtual segments.
   * Reuses the existing timeline calculation logic but works with virtual data.
   */
  private calculateSequentialTimelineWithVirtualSegments(
    sortedStops: Stop[],
    virtualSegments: TravelSegment[],
    startTime?: Date,
  ): TimelineCalculationResult {
    // Reuse existing sequential timeline calculation
    return this.calculateSequentialTimeline({
      stops: sortedStops,
      segments: virtualSegments,
      startTime,
    });
  }

  /**
   * Create comprehensive stop updates that include order changes and calculated times.
   * Pure function - merges timeline results with order changes.
   */
  private createComprehensiveStopUpdates(
    updatedStops: Stop[],
    stopOrderChanges: { stopId: string; newOrder: number }[],
  ): ComprehensiveStopUpdate[] {
    const orderMap = new Map(stopOrderChanges.map(change => [change.stopId, change.newOrder]));

    return updatedStops.map(stop => {
      const update: ComprehensiveStopUpdate = {
        id: stop.id as string,
        calculatedArrivalTime: stop.calculatedArrivalTime || undefined,
        calculatedDepartureTime: stop.calculatedDepartureTime || undefined,
      };

      // Include order change if this stop was reordered
      const newOrder = orderMap.get(stop.id as string);
      if (newOrder !== undefined) {
        update.order = newOrder;
      }

      return update;
    });
  }

  /**
   * Validate that routing data is complete for timeline calculation.
   * Pure function - checks data consistency.
   */
  validateRoutingDataCompleteness(
    stops: Stop[],
    routingData: SegmentRoutingData[],
  ): { isComplete: boolean; missingSegments: string[] } {
    if (stops.length < 2) {
      return { isComplete: true, missingSegments: [] };
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const routingMap = new Map(
      routingData.map(r => [`${r.originStopId}-${r.destinationStopId}`, r]),
    );

    const missingSegments: string[] = [];

    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originId = sortedStops[i].id;
      const destinationId = sortedStops[i + 1].id;
      const segmentKey = `${originId}-${destinationId}`;

      if (!routingMap.has(segmentKey)) {
        missingSegments.push(segmentKey);
      }
    }

    return {
      isComplete: missingSegments.length === 0,
      missingSegments,
    };
  }
}

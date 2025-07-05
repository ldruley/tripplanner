import { Injectable } from '@nestjs/common';
import {
  Stop,
  TravelSegment,
  TimelineCalculationRequest,
  TimelineCalculationResult,
  TimelineCalculationRequestSchema,
} from '@trip-planner/types';
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
}

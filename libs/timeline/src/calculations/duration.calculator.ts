import { Stop, TravelSegment } from '@trip-planner/types';
import { getDefaultStopDuration } from '../utils/stop-defaults.util';
import { StopType } from '@prisma/client';

/**
 * Calculate various duration metrics for trips
 */
export class DurationCalculator {
  /**
   * Calculate total trip duration including stops and travel
   */
  static calculateTotalTripDuration(stops: Stop[], segments: TravelSegment[]): number {
    let totalDuration = 0;

    // Sum all stop durations
    for (const stop of stops) {
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);
      totalDuration += stopDuration;
    }

    // Sum all travel durations
    for (const segment of segments) {
      const travelDuration = segment.apiCalculatedDuration || segment.duration || 0;
      totalDuration += travelDuration;
    }

    return totalDuration;
  }

  /**
   * Calculate only travel time (excluding stops)
   */
  static calculateTravelTime(segments: TravelSegment[]): number {
    return segments.reduce((total, segment) => {
      const travelDuration = segment.apiCalculatedDuration || segment.duration || 0;
      return total + travelDuration;
    }, 0);
  }

  /**
   * Calculate only stop time (excluding travel)
   */
  static calculateStopTime(stops: Stop[]): number {
    return stops.reduce((total, stop) => {
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);
      return total + stopDuration;
    }, 0);
  }

  /**
   * Calculate duration between two specific stops
   */
  static calculateDurationBetweenStops(
    stops: Stop[],
    segments: TravelSegment[],
    fromStopId: string,
    toStopId: string,
  ): number {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const fromIndex = sortedStops.findIndex(s => s.id === fromStopId);
    const toIndex = sortedStops.findIndex(s => s.id === toStopId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) {
      return 0;
    }

    let duration = 0;

    // Add stop durations (excluding the starting stop)
    for (let i = fromIndex + 1; i <= toIndex; i++) {
      const stop = sortedStops[i];
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);
      duration += stopDuration;
    }

    // Add travel durations
    for (let i = fromIndex; i < toIndex; i++) {
      const currentStop = sortedStops[i];
      const nextStop = sortedStops[i + 1];

      const segment = segments.find(
        s => s.originStopId === currentStop.id && s.destinationStopId === nextStop.id,
      );

      if (segment) {
        const travelDuration = segment.apiCalculatedDuration || segment.duration || 0;
        duration += travelDuration;
      }
    }

    return duration;
  }

  /**
   * Get duration breakdown by category
   */
  static getDurationBreakdown(stops: Stop[], segments: TravelSegment[]): DurationBreakdown {
    const breakdown: DurationBreakdown = {
      totalDuration: 0,
      stopDuration: 0,
      travelDuration: 0,
      stopBreakdown: {
        PITSTOP: 0,
        OVERNIGHT: 0,
        OTHER: 0,
      },
      travelBreakdown: {
        DRIVING: 0,
        WALKING: 0,
        BICYCLING: 0,
        TRANSIT: 0,
        PUBLIC_TRANSPORT: 0,
        UNKNOWN: 0,
      },
    };

    // Calculate stop durations by type
    for (const stop of stops) {
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);
      breakdown.stopDuration += stopDuration;

      if (stop.stopType === 'PITSTOP') {
        breakdown.stopBreakdown.PITSTOP += stopDuration;
      } else if (stop.stopType === 'OVERNIGHT') {
        breakdown.stopBreakdown.OVERNIGHT += stopDuration;
      } else {
        breakdown.stopBreakdown.OTHER += stopDuration;
      }
    }

    // Calculate travel durations by mode
    for (const segment of segments) {
      const travelDuration = segment.apiCalculatedDuration || segment.duration || 0;
      breakdown.travelDuration += travelDuration;

      const mode = segment.travelMode || 'UNKNOWN';
      if (mode in breakdown.travelBreakdown) {
        breakdown.travelBreakdown[mode as keyof typeof breakdown.travelBreakdown] += travelDuration;
      } else {
        breakdown.travelBreakdown.UNKNOWN += travelDuration;
      }
    }

    breakdown.totalDuration = breakdown.stopDuration + breakdown.travelDuration;

    return breakdown;
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Format duration in days, hours, minutes
   */
  static formatLongDuration(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    const parts: string[] = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);

    return parts.join(' ') || '0m';
  }
}

export interface DurationBreakdown {
  totalDuration: number;
  stopDuration: number;
  travelDuration: number;
  stopBreakdown: {
    PITSTOP: number;
    OVERNIGHT: number;
    OTHER: number;
  };
  travelBreakdown: {
    DRIVING: number;
    WALKING: number;
    BICYCLING: number;
    TRANSIT: number;
    PUBLIC_TRANSPORT: number;
    UNKNOWN: number;
  };
}

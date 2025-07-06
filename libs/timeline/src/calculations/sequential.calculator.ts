import { Stop, TravelSegment } from '@trip-planner/types';
import { getDefaultStopDuration } from '../utils/stop-defaults.util';
import { StopType } from '@prisma/client';

/**
 * Calculate timeline using forward-chaining approach
 * Respects user-defined durations and uses API travel times
 */
export class SequentialCalculator {
  /**
   * Calculate sequential timeline from start to end
   */
  static calculateForwardChain(stops: Stop[], segments: TravelSegment[], startTime?: Date): Stop[] {
    if (!stops || stops.length === 0) {
      return [];
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const updatedStops: Stop[] = [];

    let currentTime =
      startTime ||
      (sortedStops[0].plannedArrivalTime
        ? new Date(sortedStops[0].plannedArrivalTime)
        : new Date());

    for (let i = 0; i < sortedStops.length; i++) {
      const stop = { ...sortedStops[i] };

      // Set calculated arrival time
      stop.calculatedArrivalTime = new Date(currentTime);

      // Use user-defined duration or default suggestion
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);

      // Calculate departure time
      stop.calculatedDepartureTime = new Date(currentTime.getTime() + stopDuration * 60000);

      updatedStops.push(stop);

      // Prepare for next stop
      if (i < sortedStops.length - 1) {
        const segment = this.findSegmentBetweenStops(segments, stop.id, sortedStops[i + 1].id);
        const travelDuration = segment?.apiCalculatedDuration || segment?.duration || 0;

        currentTime = new Date(stop.calculatedDepartureTime.getTime() + travelDuration * 60000);
      }
    }

    return updatedStops;
  }

  /**
   * Calculate timeline backwards from end time
   */
  static calculateBackwardChain(stops: Stop[], segments: TravelSegment[], endTime: Date): Stop[] {
    if (!stops || stops.length === 0) {
      return [];
    }

    const sortedStops = [...stops].sort((a, b) => b.order - a.order); // Reverse order
    const updatedStops: Stop[] = [];

    let currentTime = new Date(endTime);

    for (let i = 0; i < sortedStops.length; i++) {
      const stop = { ...sortedStops[i] };

      // Use user-defined duration or default suggestion
      const stopDuration =
        stop.plannedDuration || getDefaultStopDuration(stop.stopType as StopType);

      // Calculate arrival time (working backwards)
      stop.calculatedArrivalTime = new Date(currentTime.getTime() - stopDuration * 60000);
      stop.calculatedDepartureTime = new Date(currentTime);

      updatedStops.unshift(stop); // Add to beginning to maintain order

      // Prepare for previous stop
      if (i < sortedStops.length - 1) {
        const segment = this.findSegmentBetweenStops(segments, sortedStops[i + 1].id, stop.id);
        const travelDuration = segment?.apiCalculatedDuration || segment?.duration || 0;

        currentTime = new Date(stop.calculatedArrivalTime.getTime() - travelDuration * 60000);
      }
    }

    return updatedStops;
  }

  /**
   * Update timeline starting from a specific stop
   */
  static updateFromStop(
    stops: Stop[],
    segments: TravelSegment[],
    changedStopIndex: number,
  ): Stop[] {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const updatedStops = [...sortedStops];

    // Update all stops after the changed one
    for (let i = changedStopIndex + 1; i < sortedStops.length; i++) {
      const previousStop = updatedStops[i - 1];
      const currentStop = { ...updatedStops[i] };

      if (previousStop.calculatedDepartureTime) {
        const segment = this.findSegmentBetweenStops(segments, previousStop.id, currentStop.id);
        const travelDuration = segment?.apiCalculatedDuration || segment?.duration || 0;

        currentStop.calculatedArrivalTime = new Date(
          previousStop.calculatedDepartureTime.getTime() + travelDuration * 60000,
        );

        const stopDuration =
          currentStop.plannedDuration || getDefaultStopDuration(currentStop.stopType as StopType);
        currentStop.calculatedDepartureTime = new Date(
          currentStop.calculatedArrivalTime.getTime() + stopDuration * 60000,
        );

        updatedStops[i] = currentStop;
      }
    }

    return updatedStops;
  }

  /**
   * Find travel segment between two stops
   */
  private static findSegmentBetweenStops(
    segments: TravelSegment[],
    originStopId: string,
    destinationStopId: string,
  ): TravelSegment | undefined {
    return segments.find(
      s => s.originStopId === originStopId && s.destinationStopId === destinationStopId,
    );
  }
}

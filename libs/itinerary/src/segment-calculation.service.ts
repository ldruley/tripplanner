import { Injectable, Logger } from '@nestjs/common';
import { Stop, Trip, SegmentPair } from '@trip-planner/types';

export interface SegmentCalculationOptions {
  includeAllDownstream?: boolean;
  startFromIndex?: number;
  endAtIndex?: number;
}

export interface ReorderAnalysis {
  earliestAffectedIndex: number;
  reorderedStopIds: Set<string>;
  segmentPairs: SegmentPair[];
}

export interface InsertionAnalysis {
  insertionIndex: number;
  startIndex: number;
  segmentPairs: SegmentPair[];
}

@Injectable()
export class SegmentCalculationService {
  private readonly logger = new Logger(SegmentCalculationService.name);

  /**
   * Calculate segment pairs for stop reordering operations.
   * Pure function that determines which segments need routing data.
   * 
   * @param trip - Current trip with stops
   * @param newStopOrdering - New ordering of stops
   * @param options - Calculation options
   * @return Array of segment pairs that need routing data
   */
  calculateReorderSegmentPairs(
    trip: Trip,
    newStopOrdering: Stop[],
    options: SegmentCalculationOptions = {},
  ): ReorderAnalysis {
    if (!trip.stops || trip.stops.length < 2 || newStopOrdering.length < 2) {
      return {
        earliestAffectedIndex: 0,
        reorderedStopIds: new Set(),
        segmentPairs: [],
      };
    }

    // Create maps for efficient lookup
    const originalOrderMap = new Map(trip.stops.map(stop => [stop.id as string, stop.order]));
    const reorderedStopIds = new Set<string>();

    // Identify which stops have changed positions
    for (const stop of newStopOrdering) {
      const originalOrder = originalOrderMap.get(stop.id as string);
      if (originalOrder !== undefined && originalOrder !== stop.order) {
        reorderedStopIds.add(stop.id as string);
      }
    }

    // Find the earliest position affected by reordering
    let earliestAffectedIndex = newStopOrdering.length;
    for (let i = 0; i < newStopOrdering.length; i++) {
      const stopId = newStopOrdering[i].id as string;
      if (reorderedStopIds.has(stopId)) {
        earliestAffectedIndex = Math.min(earliestAffectedIndex, i);
      }
    }

    const segmentPairs: SegmentPair[] = [];

    if (options.includeAllDownstream !== false) {
      // Include ALL segments from the earliest affected position through the end
      // This ensures complete routing data for accurate timeline propagation
      for (let i = earliestAffectedIndex; i < newStopOrdering.length - 1; i++) {
        const originStopId = newStopOrdering[i].id as string;
        const destinationStopId = newStopOrdering[i + 1].id as string;
        segmentPairs.push({
          originStopId,
          destinationStopId,
          tripId: trip.id,
        });
      }
    } else {
      // Only include segments directly involving moved stops (legacy behavior)
      for (let i = 0; i < newStopOrdering.length - 1; i++) {
        const originStopId = newStopOrdering[i].id as string;
        const destinationStopId = newStopOrdering[i + 1].id as string;

        if (reorderedStopIds.has(originStopId) || reorderedStopIds.has(destinationStopId)) {
          segmentPairs.push({
            originStopId,
            destinationStopId,
            tripId: trip.id,
          });
        }
      }
    }

    this.logger.debug(
      `Reorder analysis: ${reorderedStopIds.size} moved stops, earliest affected index: ${earliestAffectedIndex}, ${segmentPairs.length} segments needed`,
    );

    return {
      earliestAffectedIndex,
      reorderedStopIds,
      segmentPairs,
    };
  }

  /**
   * Calculate segment pairs for stop insertion operations.
   * Pure function that determines routing needs after adding a stop.
   * 
   * @param sortedStops - All stops in the trip after insertion, sorted by order
   * @param addedStopIndex - Index where the new stop was inserted
   * @param options - Calculation options
   * @return Analysis of segments that need routing data
   */
  calculateInsertionSegmentPairs(
    sortedStops: Stop[],
    addedStopIndex: number,
    tripId: string,
    options: SegmentCalculationOptions = {},
  ): InsertionAnalysis {
    if (sortedStops.length < 2 || addedStopIndex < 0 || addedStopIndex >= sortedStops.length) {
      return {
        insertionIndex: addedStopIndex,
        startIndex: 0,
        segmentPairs: [],
      };
    }

    const segmentPairs: SegmentPair[] = [];

    if (options.includeAllDownstream !== false) {
      // Include ALL segments from the insertion point through the end
      // This ensures complete routing data for accurate timeline propagation
      const startIndex = addedStopIndex > 0 ? addedStopIndex - 1 : 0;

      for (let i = startIndex; i < sortedStops.length - 1; i++) {
        segmentPairs.push({
          originStopId: sortedStops[i].id as string,
          destinationStopId: sortedStops[i + 1].id as string,
          tripId,
        });
      }

      this.logger.debug(
        `Insertion analysis: stop inserted at index ${addedStopIndex}, ${segmentPairs.length} segments needed starting from index ${startIndex}`,
      );

      return {
        insertionIndex: addedStopIndex,
        startIndex,
        segmentPairs,
      };
    } else {
      // Only include segments immediately adjacent to the new stop (legacy behavior)
      if (addedStopIndex > 0) {
        segmentPairs.push({
          originStopId: sortedStops[addedStopIndex - 1].id as string,
          destinationStopId: sortedStops[addedStopIndex].id as string,
          tripId,
        });
      }

      if (addedStopIndex < sortedStops.length - 1) {
        segmentPairs.push({
          originStopId: sortedStops[addedStopIndex].id as string,
          destinationStopId: sortedStops[addedStopIndex + 1].id as string,
          tripId,
        });
      }

      this.logger.debug(
        `Insertion analysis (adjacent only): ${segmentPairs.length} segments needed around index ${addedStopIndex}`,
      );

      return {
        insertionIndex: addedStopIndex,
        startIndex: Math.max(0, addedStopIndex - 1),
        segmentPairs,
      };
    }
  }

  /**
   * Calculate segment pairs for stop removal operations.
   * Pure function that determines routing needs after removing a stop.
   * 
   * @param remainingStops - Stops that remain after removal, sorted by order
   * @param removedStopIndex - Index where the stop was removed from
   * @param options - Calculation options
   * @return Array of segment pairs that need routing data
   */
  calculateRemovalSegmentPairs(
    remainingStops: Stop[],
    removedStopIndex: number,
    tripId: string,
    options: SegmentCalculationOptions = {},
  ): SegmentPair[] {
    if (remainingStops.length < 2) {
      return [];
    }

    const segmentPairs: SegmentPair[] = [];

    if (options.includeAllDownstream !== false) {
      // Include ALL segments from the removal point through the end
      const startIndex = Math.max(0, removedStopIndex - 1);

      for (let i = startIndex; i < remainingStops.length - 1; i++) {
        segmentPairs.push({
          originStopId: remainingStops[i].id as string,
          destinationStopId: remainingStops[i + 1].id as string,
          tripId,
        });
      }

      this.logger.debug(
        `Removal analysis: stop removed from index ${removedStopIndex}, ${segmentPairs.length} segments needed starting from index ${startIndex}`,
      );
    } else {
      // Only include the new segment that bridges the gap (legacy behavior)
      const bridgeIndex = Math.max(0, removedStopIndex - 1);
      if (bridgeIndex < remainingStops.length - 1) {
        segmentPairs.push({
          originStopId: remainingStops[bridgeIndex].id as string,
          destinationStopId: remainingStops[bridgeIndex + 1].id as string,
          tripId,
        });
      }

      this.logger.debug(
        `Removal analysis (bridge only): ${segmentPairs.length} segment needed at index ${bridgeIndex}`,
      );
    }

    return segmentPairs;
  }

  /**
   * Calculate all consecutive segment pairs for a complete trip.
   * Pure function useful for trip creation or full recalculation.
   * 
   * @param stops - All stops in the trip, sorted by order
   * @param tripId - Trip ID for the segments
   * @return Array of all consecutive segment pairs
   */
  calculateAllConsecutiveSegmentPairs(stops: Stop[], tripId: string): SegmentPair[] {
    if (stops.length < 2) {
      return [];
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const segmentPairs: SegmentPair[] = [];

    for (let i = 0; i < sortedStops.length - 1; i++) {
      segmentPairs.push({
        originStopId: sortedStops[i].id as string,
        destinationStopId: sortedStops[i + 1].id as string,
        tripId,
      });
    }

    this.logger.debug(`All consecutive pairs: ${segmentPairs.length} segments for ${stops.length} stops`);
    return segmentPairs;
  }

  /**
   * Calculate segment pairs for a custom range of stops.
   * Pure function useful for partial calculations.
   * 
   * @param stops - All stops in the trip, sorted by order
   * @param startIndex - Starting index (inclusive)
   * @param endIndex - Ending index (exclusive)
   * @param tripId - Trip ID for the segments
   * @return Array of segment pairs in the specified range
   */
  calculateRangeSegmentPairs(
    stops: Stop[],
    startIndex: number,
    endIndex: number,
    tripId: string,
  ): SegmentPair[] {
    if (stops.length < 2 || startIndex < 0 || endIndex <= startIndex || endIndex > stops.length) {
      return [];
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const segmentPairs: SegmentPair[] = [];

    for (let i = startIndex; i < Math.min(endIndex - 1, sortedStops.length - 1); i++) {
      segmentPairs.push({
        originStopId: sortedStops[i].id as string,
        destinationStopId: sortedStops[i + 1].id as string,
        tripId,
      });
    }

    this.logger.debug(
      `Range calculation: ${segmentPairs.length} segments from index ${startIndex} to ${endIndex - 1}`,
    );
    return segmentPairs;
  }

  /**
   * Validate that segment pairs are consistent and complete.
   * Pure function for data validation.
   * 
   * @param segmentPairs - Segment pairs to validate
   * @param stops - All stops in the trip for validation context
   * @return Validation result with any errors found
   */
  validateSegmentPairs(
    segmentPairs: SegmentPair[],
    stops: Stop[],
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stopIds = new Set(stops.map(stop => stop.id));

    // Check for invalid stop IDs
    for (const pair of segmentPairs) {
      if (!stopIds.has(pair.originStopId)) {
        errors.push(`Invalid origin stop ID: ${pair.originStopId}`);
      }
      if (!stopIds.has(pair.destinationStopId)) {
        errors.push(`Invalid destination stop ID: ${pair.destinationStopId}`);
      }
      if (pair.originStopId === pair.destinationStopId) {
        errors.push(`Self-referencing segment: ${pair.originStopId}`);
      }
    }

    // Check for duplicate pairs
    const pairStrings = segmentPairs.map(p => `${p.originStopId}-${p.destinationStopId}`);
    const uniquePairs = new Set(pairStrings);
    if (pairStrings.length !== uniquePairs.size) {
      errors.push('Duplicate segment pairs detected');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
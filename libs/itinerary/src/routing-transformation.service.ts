import { Injectable, Logger } from '@nestjs/common';
import { 
  CoordinateMatrix, 
  SegmentRoutingData, 
  SegmentPair, 
  Stop, 
  toCoordinateKey 
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

export interface RoutingTransformationOptions {
  defaultTravelMode?: TravelMode;
  fallbackDuration?: number;
  fallbackDistance?: number;
  includePolyline?: boolean;
}

export interface MatrixTransformationResult {
  routingData: SegmentRoutingData[];
  missingPairs: string[];
  transformedCount: number;
}

@Injectable()
export class RoutingTransformationService {
  private readonly logger = new Logger(RoutingTransformationService.name);

  /**
   * Transform coordinate matrix data into routing data for segment pairs.
   * Pure function that converts matrix lookups into structured routing information.
   * 
   * @param matrix - Coordinate matrix with distance/duration data
   * @param segmentPairs - Segment pairs needing routing data
   * @param stops - All stops with location information
   * @param options - Transformation options
   * @return Transformed routing data with missing pair tracking
   */
  transformMatrixToRoutingData(
    matrix: CoordinateMatrix,
    segmentPairs: SegmentPair[],
    stops: Stop[],
    options: RoutingTransformationOptions = {},
  ): MatrixTransformationResult {
    const {
      defaultTravelMode = 'DRIVING',
      fallbackDuration = 0,
      fallbackDistance = 0,
      includePolyline = false,
    } = options;

    // Create lookup map for stops by ID
    const stopMap = new Map(stops.map(stop => [stop.id as string, stop]));
    const routingData: SegmentRoutingData[] = [];
    const missingPairs: string[] = [];

    for (const pair of segmentPairs) {
      const originStop = stopMap.get(pair.originStopId);
      const destinationStop = stopMap.get(pair.destinationStopId);

      if (!originStop?.location || !destinationStop?.location) {
        this.logger.warn(
          `Missing location data for segment ${pair.originStopId} -> ${pair.destinationStopId}`,
        );
        missingPairs.push(`${pair.originStopId} -> ${pair.destinationStopId} (missing location)`);
        continue;
      }

      // Generate coordinate keys for matrix lookup
      const originKey = toCoordinateKey({ lat: originStop.location.latitude, lng: originStop.location.longitude });
      const destinationKey = toCoordinateKey({
        lat: destinationStop.location.latitude,
        lng: destinationStop.location.longitude,
      });

      // Look up matrix data
      const matrixEntry = matrix[originKey]?.[destinationKey];

      if (!matrixEntry) {
        // Debug logging to understand the mismatch
        this.logger.debug(`Debug matrix lookup failure:`);
        this.logger.debug(`  Generated originKey: ${originKey}`);
        this.logger.debug(`  Generated destinationKey: ${destinationKey}`);
        this.logger.debug(`  Matrix type: ${typeof matrix}`);
        this.logger.debug(`  Matrix is Array: ${Array.isArray(matrix)}`);
        this.logger.debug(`  Matrix constructor: ${matrix.constructor.name}`);
        this.logger.debug(`  Matrix keys sample (first 10): ${Object.keys(matrix).slice(0, 10).join(', ')}`);
        this.logger.debug(`  Matrix has originKey: ${matrix[originKey] ? 'YES' : 'NO'}`);
        this.logger.debug(`  Matrix direct property access: ${matrix.hasOwnProperty(originKey)}`);
        if (matrix[originKey]) {
          this.logger.debug(`  Available destination keys for ${originKey}: ${Object.keys(matrix[originKey]).join(', ')}`);
        }
        
        this.logger.warn(
          `Missing matrix data for coordinates ${originKey} -> ${destinationKey}`,
        );
        missingPairs.push(`${originKey} -> ${destinationKey} (missing matrix)`);
        
        // Create fallback routing data
        routingData.push({
          originStopId: pair.originStopId,
          destinationStopId: pair.destinationStopId,
          travelMode: defaultTravelMode,
          apiCalculatedDistance: fallbackDistance,
          apiCalculatedDuration: fallbackDuration,
          polyline: includePolyline ? null : null,
        });
        continue;
      }

      // Transform matrix entry to routing data
      // Note: Matrix has 'time' property (in seconds), convert to minutes for duration
      routingData.push({
        originStopId: pair.originStopId,
        destinationStopId: pair.destinationStopId,
        travelMode: defaultTravelMode,
        apiCalculatedDistance: matrixEntry.distance || fallbackDistance,
        apiCalculatedDuration: matrixEntry.time ? Math.ceil(matrixEntry.time / 60) : fallbackDuration,
        polyline: includePolyline ? null : null, // Matrix doesn't provide polyline data
      });
    }

    this.logger.debug(
      `Matrix transformation: ${routingData.length} routing entries created, ${missingPairs.length} missing pairs`,
    );

    return {
      routingData,
      missingPairs,
      transformedCount: routingData.length,
    };
  }

  /**
   * Create routing data from full routing API responses.
   * Standardizes routing data format across different providers.
   * 
   * @param routingResponses - Raw routing responses from APIs
   * @param segmentPairs - Segment pairs the routing data corresponds to
   * @param travelMode - Travel mode used for routing
   * @return Standardized routing data
   */
  transformRoutingResponsesToData(
    routingResponses: Array<{
      distance?: number;
      duration?: number;
      polyline?: string;
      error?: string;
    }>,
    segmentPairs: SegmentPair[],
    travelMode: TravelMode = 'DRIVING',
  ): SegmentRoutingData[] {
    if (routingResponses.length !== segmentPairs.length) {
      throw new Error(
        `Routing responses count (${routingResponses.length}) doesn't match segment pairs count (${segmentPairs.length})`,
      );
    }

    const routingData: SegmentRoutingData[] = [];

    for (let i = 0; i < segmentPairs.length; i++) {
      const response = routingResponses[i];
      const pair = segmentPairs[i];

      if (response.error) {
        this.logger.warn(
          `Routing error for ${pair.originStopId} -> ${pair.destinationStopId}: ${response.error}`,
        );
      }

      routingData.push({
        originStopId: pair.originStopId,
        destinationStopId: pair.destinationStopId,
        travelMode,
        apiCalculatedDistance: response.distance || null,
        apiCalculatedDuration: response.duration || null,
        polyline: response.polyline || null,
      });
    }

    this.logger.debug(`Transformed ${routingData.length} routing responses to routing data`);
    return routingData;
  }

  /**
   * Merge multiple routing data arrays, handling conflicts and duplicates.
   * Useful when combining matrix data with fresh routing calculations.
   * 
   * @param primaryData - Primary routing data (takes precedence)
   * @param secondaryData - Secondary routing data (fallback values)
   * @param conflictResolution - How to resolve conflicts ('primary' | 'secondary' | 'newest' | 'best')
   * @return Merged routing data
   */
  mergeRoutingData(
    primaryData: SegmentRoutingData[],
    secondaryData: SegmentRoutingData[],
    conflictResolution: 'primary' | 'secondary' | 'newest' | 'best' = 'primary',
  ): SegmentRoutingData[] {
    // Create lookup map for secondary data
    const secondaryMap = new Map(
      secondaryData.map(data => [`${data.originStopId}-${data.destinationStopId}`, data]),
    );

    const mergedData: SegmentRoutingData[] = [];
    const processedPairs = new Set<string>();

    // Process primary data first
    for (const data of primaryData) {
      const pairKey = `${data.originStopId}-${data.destinationStopId}`;
      const secondaryEntry = secondaryMap.get(pairKey);

      if (secondaryEntry && conflictResolution !== 'primary') {
        mergedData.push(this.resolveRoutingConflict(data, secondaryEntry, conflictResolution));
      } else {
        mergedData.push(data);
      }

      processedPairs.add(pairKey);
    }

    // Add remaining secondary data
    for (const data of secondaryData) {
      const pairKey = `${data.originStopId}-${data.destinationStopId}`;
      if (!processedPairs.has(pairKey)) {
        mergedData.push(data);
      }
    }

    this.logger.debug(
      `Merged routing data: ${primaryData.length} primary + ${secondaryData.length} secondary = ${mergedData.length} final`,
    );

    return mergedData;
  }

  /**
   * Resolve conflicts between two routing data entries for the same segment.
   * Pure function that applies conflict resolution logic.
   */
  private resolveRoutingConflict(
    primary: SegmentRoutingData,
    secondary: SegmentRoutingData,
    resolution: 'primary' | 'secondary' | 'newest' | 'best',
  ): SegmentRoutingData {
    switch (resolution) {
      case 'primary':
        return primary;
      case 'secondary':
        return secondary;
      case 'newest':
        // For simplicity, assume primary is newer in this context
        return primary;
      case 'best':
        // Choose the entry with the most complete data
        const primaryScore = this.calculateDataCompleteness(primary);
        const secondaryScore = this.calculateDataCompleteness(secondary);
        return primaryScore >= secondaryScore ? primary : secondary;
      default:
        return primary;
    }
  }

  /**
   * Calculate completeness score for routing data entry.
   * Higher scores indicate more complete data.
   */
  private calculateDataCompleteness(data: SegmentRoutingData): number {
    let score = 0;
    if (data.apiCalculatedDistance !== null && data.apiCalculatedDistance !== undefined) score += 1;
    if (data.apiCalculatedDuration !== null && data.apiCalculatedDuration !== undefined) score += 1;
    if (data.polyline) score += 1;
    if (data.travelMode) score += 1;
    return score;
  }

  /**
   * Filter routing data to only include valid entries.
   * Removes entries with missing or invalid data based on criteria.
   * 
   * @param routingData - Routing data to filter
   * @param criteria - Filtering criteria
   * @return Filtered routing data
   */
  filterValidRoutingData(
    routingData: SegmentRoutingData[],
    criteria: {
      requireDistance?: boolean;
      requireDuration?: boolean;
      requirePolyline?: boolean;
      minDistance?: number;
      maxDistance?: number;
      minDuration?: number;
      maxDuration?: number;
    } = {},
  ): SegmentRoutingData[] {
    const filtered = routingData.filter(data => {
      // Check required fields
      if (criteria.requireDistance && !data.apiCalculatedDistance) return false;
      if (criteria.requireDuration && !data.apiCalculatedDuration) return false;
      if (criteria.requirePolyline && !data.polyline) return false;

      // Check value ranges
      if (criteria.minDistance && (data.apiCalculatedDistance || 0) < criteria.minDistance) return false;
      if (criteria.maxDistance && (data.apiCalculatedDistance || 0) > criteria.maxDistance) return false;
      if (criteria.minDuration && (data.apiCalculatedDuration || 0) < criteria.minDuration) return false;
      if (criteria.maxDuration && (data.apiCalculatedDuration || 0) > criteria.maxDuration) return false;

      return true;
    });

    this.logger.debug(
      `Filtered routing data: ${routingData.length} -> ${filtered.length} entries`,
    );

    return filtered;
  }

  /**
   * Validate routing data completeness and consistency.
   * Pure function for comprehensive data validation.
   * 
   * @param routingData - Routing data to validate
   * @return Validation result with detailed errors
   */
  validateRoutingData(routingData: SegmentRoutingData[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validCount: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validCount = 0;

    for (const data of routingData) {
      let isEntryValid = true;

      // Check required fields
      if (!data.originStopId) {
        errors.push('Missing origin stop ID');
        isEntryValid = false;
      }
      if (!data.destinationStopId) {
        errors.push('Missing destination stop ID');
        isEntryValid = false;
      }
      if (data.originStopId === data.destinationStopId) {
        errors.push(`Self-referencing segment: ${data.originStopId}`);
        isEntryValid = false;
      }

      // Check for reasonable values
      if (data.apiCalculatedDistance !== null && data.apiCalculatedDistance !== undefined) {
        if (data.apiCalculatedDistance < 0) {
          errors.push(`Negative distance for ${data.originStopId} -> ${data.destinationStopId}`);
          isEntryValid = false;
        } else if (data.apiCalculatedDistance > 10000000) { // 10,000 km
          warnings.push(`Very large distance for ${data.originStopId} -> ${data.destinationStopId}`);
        }
      }

      if (data.apiCalculatedDuration !== null && data.apiCalculatedDuration !== undefined) {
        if (data.apiCalculatedDuration < 0) {
          errors.push(`Negative duration for ${data.originStopId} -> ${data.destinationStopId}`);
          isEntryValid = false;
        } else if (data.apiCalculatedDuration > 43200) { // 30 days in minutes
          warnings.push(`Very long duration for ${data.originStopId} -> ${data.destinationStopId}`);
        }
      }

      if (isEntryValid) {
        validCount++;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validCount,
    };
  }
}
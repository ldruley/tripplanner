import { Injectable, Logger } from '@nestjs/common';
import { SegmentCalculationService } from './segment-calculation.service';
import { RoutingTransformationService } from './routing-transformation.service';
import { SharedValidationService } from './shared-validation.service';
import { Trip, Stop, SegmentPair, SegmentRoutingData, CoordinateMatrix } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

export interface SegmentPlanningRequest {
  trip: Trip;
  operationType: 'reorder' | 'add' | 'remove' | 'create' | 'custom';
  newStopOrdering?: Stop[];
  addedStopIndex?: number;
  removedStopIndex?: number;
  customSegmentPairs?: SegmentPair[];
  matrix?: CoordinateMatrix;
  travelMode?: TravelMode;
  includeAllDownstream?: boolean;
}

export interface SegmentPlanningResult {
  segmentPairs: SegmentPair[];
  routingData: SegmentRoutingData[];
  analysis: {
    operationType: string;
    affectedStopCount: number;
    segmentCount: number;
    missingMatrixPairs: string[];
    hasCompleteData: boolean;
  };
  metadata: {
    planningTime: number;
    cacheUsed: boolean;
    fallbacksApplied: number;
  };
}

@Injectable()
export class SegmentPlanningService {
  private readonly logger = new Logger(SegmentPlanningService.name);

  constructor(
    private readonly segmentCalculationService: SegmentCalculationService,
    private readonly routingTransformationService: RoutingTransformationService,
    private readonly sharedValidationService: SharedValidationService,
  ) {}

  /**
   * Comprehensive segment planning for any type of trip modification.
   * Orchestrates segment calculation and routing data preparation.
   *
   * @param request - Complete planning request with operation details
   * @return Planning result with segments, routing data, and analysis
   */
  async planSegmentsForOperation(request: SegmentPlanningRequest): Promise<SegmentPlanningResult> {
    const startTime = Date.now();

    this.logger.debug(
      `Planning segments for ${request.operationType} operation on trip ${request.trip.id}`,
    );

    // Step 1: Calculate required segment pairs based on operation type
    const segmentPairs = this.calculateSegmentPairsForOperation(request);

    // Step 2: Generate routing data from matrix if available
    const routingDataResult = this.generateRoutingDataFromMatrix(
      segmentPairs,
      request.trip.stops || [],
      request.matrix,
      {
        defaultTravelMode: request.travelMode || 'DRIVING',
        fallbackDuration: 0,
        fallbackDistance: 0,
        includePolyline: false,
      },
    );

    // Step 3: Validate completeness and quality
    const validation = this.routingTransformationService.validateRoutingData(
      routingDataResult.routingData,
    );

    // Step 4: Analyze operation impact
    const analysis = this.analyzeOperationImpact(request, segmentPairs, routingDataResult);

    const planningTime = Date.now() - startTime;

    this.logger.log(
      `Segment planning completed in ${planningTime}ms: ${segmentPairs.length} segments, ${routingDataResult.routingData.length} routing entries`,
    );

    return {
      segmentPairs,
      routingData: routingDataResult.routingData,
      analysis,
      metadata: {
        planningTime,
        cacheUsed: false, // Could be implemented for optimization
        fallbacksApplied: routingDataResult.missingPairs.length,
      },
    };
  }

  /**
   * Calculate segment pairs based on the type of operation being performed.
   * Delegates to appropriate calculation method with operation-specific logic.
   */
  private calculateSegmentPairsForOperation(request: SegmentPlanningRequest): SegmentPair[] {
    const { trip, operationType, includeAllDownstream = true } = request;
    const options = { includeAllDownstream };

    switch (operationType) {
      case 'reorder': {
        if (!request.newStopOrdering) {
          throw new Error('New stop ordering required for reorder operation');
        }
        const reorderAnalysis = this.segmentCalculationService.calculateReorderSegmentPairs(
          trip,
          request.newStopOrdering,
          options,
        );
        return reorderAnalysis.segmentPairs;
      }

      case 'add': {
        if (request.addedStopIndex === undefined || !request.newStopOrdering) {
          throw new Error('Added stop index and new ordering required for add operation');
        }
        const insertionAnalysis = this.segmentCalculationService.calculateInsertionSegmentPairs(
          request.newStopOrdering,
          request.addedStopIndex,
          trip.id,
          options,
        );
        return insertionAnalysis.segmentPairs;
      }

      case 'remove':
        if (request.removedStopIndex === undefined || !request.newStopOrdering) {
          throw new Error('Removed stop index and remaining stops required for remove operation');
        }
        return this.segmentCalculationService.calculateRemovalSegmentPairs(
          request.newStopOrdering,
          request.removedStopIndex,
          trip.id,
          options,
        );

      case 'create':
        return this.segmentCalculationService.calculateAllConsecutiveSegmentPairs(
          trip.stops || [],
          trip.id,
        );

      case 'custom':
        if (!request.customSegmentPairs) {
          throw new Error('Custom segment pairs required for custom operation');
        }
        return request.customSegmentPairs;

      default:
        throw new Error(`Unsupported operation type: ${operationType}`);
    }
  }

  /**
   * Generate routing data from coordinate matrix if available.
   * Handles missing data gracefully with fallbacks.
   */
  private generateRoutingDataFromMatrix(
    segmentPairs: SegmentPair[],
    stops: Stop[],
    matrix?: CoordinateMatrix,
    options?: {
      defaultTravelMode?: TravelMode;
      fallbackDuration?: number;
      fallbackDistance?: number;
      includePolyline?: boolean;
    },
  ): {
    routingData: SegmentRoutingData[];
    missingPairs: string[];
    transformedCount: number;
  } {
    if (!matrix || segmentPairs.length === 0) {
      return {
        routingData: [],
        missingPairs: [],
        transformedCount: 0,
      };
    }

    // Validate matrix completeness before transformation
    const matrixValidation = this.sharedValidationService.validateMatrixCompleteness(matrix, stops);
    if (!matrixValidation.isValid) {
      this.logger.warn(`Matrix validation warnings: ${matrixValidation.errors.join(', ')}`);
    }

    // Transform matrix to routing data
    return this.routingTransformationService.transformMatrixToRoutingData(
      matrix,
      segmentPairs,
      stops,
      options,
    );
  }

  /**
   * Analyze the impact and scope of the planned operation.
   * Provides detailed insights for logging and validation.
   */
  private analyzeOperationImpact(
    request: SegmentPlanningRequest,
    segmentPairs: SegmentPair[],
    routingDataResult: {
      routingData: SegmentRoutingData[];
      missingPairs: string[];
      transformedCount: number;
    },
  ): SegmentPlanningResult['analysis'] {
    const affectedStopIds = new Set<string>();

    // Count affected stops from segment pairs
    for (const pair of segmentPairs) {
      affectedStopIds.add(pair.originStopId);
      affectedStopIds.add(pair.destinationStopId);
    }

    return {
      operationType: request.operationType,
      affectedStopCount: affectedStopIds.size,
      segmentCount: segmentPairs.length,
      missingMatrixPairs: routingDataResult.missingPairs,
      hasCompleteData: routingDataResult.missingPairs.length === 0,
    };
  }

  /**
   * Plan segments for stop reordering with detailed analysis.
   * Specialized method that provides additional reordering insights.
   */
  async planReorderingSegments(
    trip: Trip,
    newStopOrdering: Stop[],
    matrix?: CoordinateMatrix,
    options?: { includeAllDownstream?: boolean; travelMode?: TravelMode },
  ): Promise<SegmentPlanningResult & { reorderAnalysis: any }> {
    const reorderAnalysis = this.segmentCalculationService.calculateReorderSegmentPairs(
      trip,
      newStopOrdering,
      { includeAllDownstream: options?.includeAllDownstream ?? true },
    );

    const request: SegmentPlanningRequest = {
      trip,
      operationType: 'reorder',
      newStopOrdering,
      matrix,
      travelMode: options?.travelMode,
      includeAllDownstream: options?.includeAllDownstream,
    };

    const result = await this.planSegmentsForOperation(request);

    return {
      ...result,
      reorderAnalysis: {
        earliestAffectedIndex: reorderAnalysis.earliestAffectedIndex,
        reorderedStopIds: Array.from(reorderAnalysis.reorderedStopIds),
        reorderedStopCount: reorderAnalysis.reorderedStopIds.size,
      },
    };
  }

  /**
   * Plan segments for stop insertion with detailed analysis.
   * Specialized method that provides additional insertion insights.
   */
  async planInsertionSegments(
    trip: Trip,
    newStopOrdering: Stop[],
    addedStopIndex: number,
    matrix?: CoordinateMatrix,
    options?: { includeAllDownstream?: boolean; travelMode?: TravelMode },
  ): Promise<SegmentPlanningResult & { insertionAnalysis: any }> {
    const insertionAnalysis = this.segmentCalculationService.calculateInsertionSegmentPairs(
      newStopOrdering,
      addedStopIndex,
      trip.id,
      { includeAllDownstream: options?.includeAllDownstream ?? true },
    );

    const request: SegmentPlanningRequest = {
      trip,
      operationType: 'add',
      newStopOrdering,
      addedStopIndex,
      matrix,
      travelMode: options?.travelMode,
      includeAllDownstream: options?.includeAllDownstream,
    };

    const result = await this.planSegmentsForOperation(request);

    return {
      ...result,
      insertionAnalysis: {
        insertionIndex: insertionAnalysis.insertionIndex,
        startIndex: insertionAnalysis.startIndex,
        affectedStopCount: Math.max(0, newStopOrdering.length - insertionAnalysis.startIndex),
      },
    };
  }

  /**
   * Validate segment planning request for completeness and consistency.
   * Ensures all required data is present before planning execution.
   */
  validatePlanningRequest(request: SegmentPlanningRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!request.trip) {
      errors.push('Trip is required');
    } else if (!request.trip.stops || request.trip.stops.length === 0) {
      errors.push('Trip must have stops');
    }

    if (!request.operationType) {
      errors.push('Operation type is required');
    }

    // Operation-specific validation
    switch (request.operationType) {
      case 'reorder':
        if (!request.newStopOrdering) {
          errors.push('New stop ordering required for reorder operation');
        } else if (request.newStopOrdering.length !== (request.trip.stops?.length || 0)) {
          errors.push('New stop ordering must include all existing stops');
        }
        break;

      case 'add':
        if (request.addedStopIndex === undefined) {
          errors.push('Added stop index required for add operation');
        }
        if (!request.newStopOrdering) {
          errors.push('New stop ordering required for add operation');
        }
        break;

      case 'remove':
        if (request.removedStopIndex === undefined) {
          errors.push('Removed stop index required for remove operation');
        }
        if (!request.newStopOrdering) {
          errors.push('Remaining stops required for remove operation');
        }
        break;

      case 'custom':
        if (!request.customSegmentPairs || request.customSegmentPairs.length === 0) {
          errors.push('Custom segment pairs required for custom operation');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compare segment planning results to identify differences.
   * Useful for testing and optimization analysis.
   */
  compareSegmentPlans(
    plan1: SegmentPlanningResult,
    plan2: SegmentPlanningResult,
  ): {
    segmentDifferences: string[];
    routingDifferences: string[];
    analysisDifferences: string[];
  } {
    const segmentDifferences: string[] = [];
    const routingDifferences: string[] = [];
    const analysisDifferences: string[] = [];

    // Compare segment pairs
    const pairs1 = plan1.segmentPairs.map(p => `${p.originStopId}-${p.destinationStopId}`);
    const pairs2 = plan2.segmentPairs.map(p => `${p.originStopId}-${p.destinationStopId}`);

    const uniqueToPlan1 = pairs1.filter(p => !pairs2.includes(p));
    const uniqueToPlan2 = pairs2.filter(p => !pairs1.includes(p));

    if (uniqueToPlan1.length > 0) {
      segmentDifferences.push(`Plan 1 unique segments: ${uniqueToPlan1.join(', ')}`);
    }
    if (uniqueToPlan2.length > 0) {
      segmentDifferences.push(`Plan 2 unique segments: ${uniqueToPlan2.join(', ')}`);
    }

    // Compare routing data counts
    if (plan1.routingData.length !== plan2.routingData.length) {
      routingDifferences.push(
        `Different routing data counts: ${plan1.routingData.length} vs ${plan2.routingData.length}`,
      );
    }

    // Compare analysis
    if (plan1.analysis.affectedStopCount !== plan2.analysis.affectedStopCount) {
      analysisDifferences.push(
        `Different affected stop counts: ${plan1.analysis.affectedStopCount} vs ${plan2.analysis.affectedStopCount}`,
      );
    }

    return {
      segmentDifferences,
      routingDifferences,
      analysisDifferences,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { RoutingCoordinationService } from './routing-coordination.service';
import { RoutingTransformationService } from './routing-transformation.service';
import { SharedValidationService } from './shared-validation.service';
import { 
  SegmentPair, 
  SegmentRoutingData, 
  CoordinateMatrix, 
  Stop,
  Trip 
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

export interface RoutingStrategy {
  preferMatrix: boolean;
  fallbackToAPI: boolean;
  forceRefresh: boolean;
  useCache: boolean;
  timeoutMs?: number;
}

export interface RoutingRequest {
  segmentPairs: SegmentPair[];
  stops: Stop[];
  trip: Trip;
  strategy: RoutingStrategy;
  travelMode?: TravelMode;
  matrix?: CoordinateMatrix;
  batchSize?: number;
}

export interface RoutingResult {
  routingData: SegmentRoutingData[];
  source: 'matrix' | 'api' | 'hybrid' | 'cache';
  completeness: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
    fromMatrix: number;
    fromAPI: number;
  };
  performance: {
    totalTime: number;
    matrixTime?: number;
    apiTime?: number;
    cacheHits: number;
    cacheMisses: number;
  };
  errors: string[];
  warnings: string[];
}

export interface RoutingBatchResult {
  batches: RoutingResult[];
  combined: RoutingResult;
  batchMetadata: {
    batchCount: number;
    averageBatchSize: number;
    totalProcessingTime: number;
  };
}

@Injectable()
export class RoutingIntegrationService {
  private readonly logger = new Logger(RoutingIntegrationService.name);

  constructor(
    private readonly routingCoordinationService: RoutingCoordinationService,
    private readonly routingTransformationService: RoutingTransformationService,
    private readonly sharedValidationService: SharedValidationService,
  ) {}

  /**
   * Comprehensive routing data acquisition with multiple strategies.
   * Orchestrates matrix lookups, API calls, and caching for optimal performance.
   * 
   * @param request - Complete routing request with strategy and options
   * @return Routing result with data and performance metrics
   */
  async acquireRoutingData(request: RoutingRequest): Promise<RoutingResult> {
    const startTime = Date.now();
    
    this.logger.debug(
      `Acquiring routing data for ${request.segmentPairs.length} segments using ${request.strategy.preferMatrix ? 'matrix-first' : 'api-first'} strategy`,
    );

    // Step 1: Validate the request
    const validation = this.validateRoutingRequest(request);
    if (!validation.isValid) {
      return this.createErrorResult(validation.errors, startTime);
    }

    // Step 2: Try matrix data first if preferred
    let routingResult: RoutingResult;
    
    if (request.strategy.preferMatrix && request.matrix) {
      routingResult = await this.acquireFromMatrix(request, startTime);
      
      // Fall back to API if matrix data is incomplete and fallback is enabled
      if (request.strategy.fallbackToAPI && routingResult.completeness.failed > 0) {
        routingResult = await this.supplementWithAPI(request, routingResult, startTime);
      }
    } else {
      // Use API as primary source
      routingResult = await this.acquireFromAPI(request, startTime);
      
      // Fall back to matrix for failed segments if available
      if (request.matrix && routingResult.completeness.failed > 0) {
        routingResult = await this.supplementWithMatrix(request, routingResult, startTime);
      }
    }

    this.logger.log(
      `Routing acquisition completed: ${routingResult.completeness.successful}/${routingResult.completeness.total} segments in ${routingResult.performance.totalTime}ms`,
    );

    return routingResult;
  }

  /**
   * Acquire routing data from coordinate matrix.
   * Fast lookup method using pre-calculated matrix data.
   */
  private async acquireFromMatrix(request: RoutingRequest, startTime: number): Promise<RoutingResult> {
    const matrixStartTime = Date.now();
    
    const transformResult = this.routingTransformationService.transformMatrixToRoutingData(
      request.matrix!,
      request.segmentPairs,
      request.stops,
      {
        defaultTravelMode: request.travelMode || 'DRIVING',
        fallbackDuration: 0,
        fallbackDistance: 0,
        includePolyline: false,
      },
    );

    const matrixTime = Date.now() - matrixStartTime;
    const totalTime = Date.now() - startTime;

    return {
      routingData: transformResult.routingData,
      source: 'matrix',
      completeness: {
        total: request.segmentPairs.length,
        successful: transformResult.transformedCount,
        failed: transformResult.missingPairs.length,
        cached: 0,
        fromMatrix: transformResult.transformedCount,
        fromAPI: 0,
      },
      performance: {
        totalTime,
        matrixTime,
        cacheHits: 0,
        cacheMisses: 0,
      },
      errors: transformResult.missingPairs.length > 0 
        ? [`Missing matrix data for ${transformResult.missingPairs.length} segment pairs`]
        : [],
      warnings: [],
    };
  }

  /**
   * Acquire routing data from routing API.
   * Full routing calculation with detailed route information.
   */
  private async acquireFromAPI(request: RoutingRequest, startTime: number): Promise<RoutingResult> {
    const apiStartTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Use existing routing coordination service for API calls
      const routingResults = await this.routingCoordinationService.calculateRoutingForSegmentPairs(
        request.segmentPairs,
        request.trip,
        request.travelMode || 'DRIVING',
      );

      // Extract routing data from results
      const routingData = routingResults.map(result => result.routingData);

      const apiTime = Date.now() - apiStartTime;
      const totalTime = Date.now() - startTime;

      return {
        routingData,
        source: 'api',
        completeness: {
          total: request.segmentPairs.length,
          successful: routingData.length,
          failed: Math.max(0, request.segmentPairs.length - routingData.length),
          cached: 0,
          fromMatrix: 0,
          fromAPI: routingData.length,
        },
        performance: {
          totalTime,
          apiTime,
          cacheHits: 0,
          cacheMisses: request.segmentPairs.length,
        },
        errors,
        warnings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      errors.push(`API routing failed: ${errorMessage}`);
      
      return this.createErrorResult(errors, startTime);
    }
  }

  /**
   * Supplement matrix data with API calls for missing segments.
   * Hybrid approach that combines matrix speed with API completeness.
   */
  private async supplementWithAPI(
    request: RoutingRequest,
    matrixResult: RoutingResult,
    startTime: number,
  ): Promise<RoutingResult> {
    const supplementStartTime = Date.now();
    
    // Identify segments that need API routing
    const matrixDataMap = new Map(
      matrixResult.routingData.map(data => 
        [`${data.originStopId}-${data.destinationStopId}`, data]
      ),
    );
    
    const missingSegments = request.segmentPairs.filter(pair => 
      !matrixDataMap.has(`${pair.originStopId}-${pair.destinationStopId}`)
    );

    if (missingSegments.length === 0) {
      return matrixResult;
    }

    this.logger.debug(`Supplementing ${missingSegments.length} missing segments with API routing`);

    try {
      const apiRoutingResults = await this.routingCoordinationService.calculateRoutingForSegmentPairs(
        missingSegments,
        request.trip,
        request.travelMode || 'DRIVING',
      );

      // Extract routing data from results
      const apiRoutingData = apiRoutingResults.map(result => result.routingData);

      // Merge matrix and API data
      const combinedRoutingData = this.routingTransformationService.mergeRoutingData(
        matrixResult.routingData,
        apiRoutingData,
        'primary', // Matrix data takes precedence
      );

      const supplementTime = Date.now() - supplementStartTime;
      const totalTime = Date.now() - startTime;

      return {
        routingData: combinedRoutingData,
        source: 'hybrid',
        completeness: {
          total: request.segmentPairs.length,
          successful: combinedRoutingData.length,
          failed: Math.max(0, request.segmentPairs.length - combinedRoutingData.length),
          cached: 0,
          fromMatrix: matrixResult.completeness.fromMatrix,
          fromAPI: apiRoutingData.length,
        },
        performance: {
          totalTime,
          matrixTime: matrixResult.performance.matrixTime,
          apiTime: supplementTime,
          cacheHits: 0,
          cacheMisses: missingSegments.length,
        },
        errors: [...matrixResult.errors],
        warnings: [...matrixResult.warnings, `Supplemented ${apiRoutingData.length} segments with API data`],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      return {
        ...matrixResult,
        source: 'hybrid',
        errors: [...matrixResult.errors, `API supplement failed: ${errorMessage}`],
      };
    }
  }

  /**
   * Supplement API data with matrix fallbacks for failed segments.
   * Provides matrix fallbacks when API calls fail.
   */
  private async supplementWithMatrix(
    request: RoutingRequest,
    apiResult: RoutingResult,
    startTime: number,
  ): Promise<RoutingResult> {
    if (!request.matrix) {
      return apiResult;
    }

    const supplementStartTime = Date.now();
    
    // Use matrix data as fallback for any missing segments
    const transformResult = this.routingTransformationService.transformMatrixToRoutingData(
      request.matrix,
      request.segmentPairs,
      request.stops,
      {
        defaultTravelMode: request.travelMode || 'DRIVING',
        fallbackDuration: 0,
        fallbackDistance: 0,
        includePolyline: false,
      },
    );

    // Merge API and matrix data (API takes precedence)
    const combinedRoutingData = this.routingTransformationService.mergeRoutingData(
      apiResult.routingData,
      transformResult.routingData,
      'primary', // API data takes precedence
    );

    const supplementTime = Date.now() - supplementStartTime;
    const totalTime = Date.now() - startTime;

    return {
      routingData: combinedRoutingData,
      source: 'hybrid',
      completeness: {
        total: request.segmentPairs.length,
        successful: combinedRoutingData.length,
        failed: Math.max(0, request.segmentPairs.length - combinedRoutingData.length),
        cached: 0,
        fromMatrix: transformResult.transformedCount,
        fromAPI: apiResult.completeness.fromAPI,
      },
      performance: {
        totalTime,
        matrixTime: supplementTime,
        apiTime: apiResult.performance.apiTime,
        cacheHits: 0,
        cacheMisses: apiResult.performance.cacheMisses,
      },
      errors: [...apiResult.errors],
      warnings: [...apiResult.warnings, `Supplemented with matrix data for fallback`],
    };
  }

  /**
   * Process routing requests in batches for large segment counts.
   * Manages memory and API rate limits through intelligent batching.
   */
  async acquireRoutingDataInBatches(request: RoutingRequest): Promise<RoutingBatchResult> {
    const batchSize = request.batchSize || 50;
    const totalStartTime = Date.now();
    
    if (request.segmentPairs.length <= batchSize) {
      // No batching needed
      const result = await this.acquireRoutingData(request);
      return {
        batches: [result],
        combined: result,
        batchMetadata: {
          batchCount: 1,
          averageBatchSize: request.segmentPairs.length,
          totalProcessingTime: result.performance.totalTime,
        },
      };
    }

    this.logger.debug(
      `Processing ${request.segmentPairs.length} segments in batches of ${batchSize}`,
    );

    const batches: RoutingResult[] = [];
    const allRoutingData: SegmentRoutingData[] = [];
    let totalErrors: string[] = [];
    let totalWarnings: string[] = [];
    
    // Process segments in batches
    for (let i = 0; i < request.segmentPairs.length; i += batchSize) {
      const batchSegments = request.segmentPairs.slice(i, i + batchSize);
      const batchRequest: RoutingRequest = {
        ...request,
        segmentPairs: batchSegments,
      };
      
      this.logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batchSegments.length} segments`);
      
      const batchResult = await this.acquireRoutingData(batchRequest);
      batches.push(batchResult);
      allRoutingData.push(...batchResult.routingData);
      totalErrors.push(...batchResult.errors);
      totalWarnings.push(...batchResult.warnings);
    }

    const totalTime = Date.now() - totalStartTime;

    // Combine results
    const combinedResult: RoutingResult = {
      routingData: allRoutingData,
      source: batches.every(b => b.source === 'matrix') ? 'matrix' : 
              batches.every(b => b.source === 'api') ? 'api' : 'hybrid',
      completeness: {
        total: request.segmentPairs.length,
        successful: allRoutingData.length,
        failed: request.segmentPairs.length - allRoutingData.length,
        cached: batches.reduce((sum, b) => sum + b.completeness.cached, 0),
        fromMatrix: batches.reduce((sum, b) => sum + b.completeness.fromMatrix, 0),
        fromAPI: batches.reduce((sum, b) => sum + b.completeness.fromAPI, 0),
      },
      performance: {
        totalTime,
        matrixTime: batches.reduce((sum, b) => sum + (b.performance.matrixTime || 0), 0),
        apiTime: batches.reduce((sum, b) => sum + (b.performance.apiTime || 0), 0),
        cacheHits: batches.reduce((sum, b) => sum + b.performance.cacheHits, 0),
        cacheMisses: batches.reduce((sum, b) => sum + b.performance.cacheMisses, 0),
      },
      errors: totalErrors,
      warnings: totalWarnings,
    };

    return {
      batches,
      combined: combinedResult,
      batchMetadata: {
        batchCount: batches.length,
        averageBatchSize: request.segmentPairs.length / batches.length,
        totalProcessingTime: totalTime,
      },
    };
  }

  /**
   * Validate routing request for completeness and consistency.
   * Ensures all required data is present before processing.
   */
  private validateRoutingRequest(request: RoutingRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.segmentPairs || request.segmentPairs.length === 0) {
      errors.push('Segment pairs are required');
    }

    if (!request.stops || request.stops.length === 0) {
      errors.push('Stops are required');
    }

    if (!request.trip) {
      errors.push('Trip is required');
    }

    if (!request.strategy) {
      errors.push('Routing strategy is required');
    }

    // Validate segment pairs reference valid stops
    if (request.segmentPairs && request.stops) {
      const stopIds = new Set(request.stops.map(stop => stop.id));
      for (const pair of request.segmentPairs) {
        if (!stopIds.has(pair.originStopId)) {
          errors.push(`Invalid origin stop ID: ${pair.originStopId}`);
        }
        if (!stopIds.has(pair.destinationStopId)) {
          errors.push(`Invalid destination stop ID: ${pair.destinationStopId}`);
        }
      }
    }

    // Validate matrix if provided
    if (request.matrix && request.stops) {
      const validation = this.sharedValidationService.validateMatrixCompleteness(
        request.matrix,
        request.stops,
      );
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create error result for failed routing operations.
   * Provides consistent error structure across all failure modes.
   */
  private createErrorResult(errors: string[], startTime: number): RoutingResult {
    return {
      routingData: [],
      source: 'api',
      completeness: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0,
        fromMatrix: 0,
        fromAPI: 0,
      },
      performance: {
        totalTime: Date.now() - startTime,
        cacheHits: 0,
        cacheMisses: 0,
      },
      errors,
      warnings: [],
    };
  }

  /**
   * Get optimal routing strategy based on request characteristics.
   * Provides intelligent strategy selection for different scenarios.
   */
  getOptimalStrategy(
    segmentCount: number,
    hasMatrix: boolean,
    preferSpeed: boolean,
    requireAccuracy: boolean,
  ): RoutingStrategy {
    // Large segment counts benefit from matrix when available
    if (segmentCount > 20 && hasMatrix && preferSpeed) {
      return {
        preferMatrix: true,
        fallbackToAPI: requireAccuracy,
        forceRefresh: false,
        useCache: true,
        timeoutMs: 30000,
      };
    }

    // Small segment counts can use API directly
    if (segmentCount <= 5 || requireAccuracy) {
      return {
        preferMatrix: false,
        fallbackToAPI: true,
        forceRefresh: false,
        useCache: true,
        timeoutMs: 15000,
      };
    }

    // Balanced approach for medium segment counts
    return {
      preferMatrix: hasMatrix,
      fallbackToAPI: true,
      forceRefresh: false,
      useCache: true,
      timeoutMs: 20000,
    };
  }
}
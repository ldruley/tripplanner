import { Injectable, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { TimelineService } from '@trip-planner/timeline';
import { RoutingCoordinationService } from './routing-coordination.service';
import { SegmentPlanningService } from './segment-planning.service';
import { RoutingIntegrationService } from './routing-integration.service';
import { OrderManagementService } from './order-management.service';
import { TimelineCoordinationService } from './timeline-coordination.service';
import { SharedValidationService } from './shared-validation.service';
import { SharedTransactionService } from './shared-transaction.service';
import {
  Trip,
  SegmentRoutingData,
  ComprehensiveStopUpdate,
  BatchExecutionPlan,
  BatchResult,
} from '@trip-planner/types';
import {
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
  CreateTripFromOrderedListDto,
} from '@trip-planner/shared/dtos';
import { TravelMode } from '@prisma/client';

@Injectable()
export class UnifiedBatchingService {
  private readonly logger = new Logger(UnifiedBatchingService.name);

  constructor(
    // Core services
    private readonly tripService: TripService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
    private readonly timelineService: TimelineService,
    private readonly routingCoordinationService: RoutingCoordinationService,
    
    // Advanced orchestration services
    private readonly segmentPlanningService: SegmentPlanningService,
    private readonly routingIntegrationService: RoutingIntegrationService,
    private readonly orderManagementService: OrderManagementService,
    private readonly timelineCoordinationService: TimelineCoordinationService,
    private readonly sharedValidationService: SharedValidationService,
    private readonly sharedTransactionService: SharedTransactionService,
  ) {}

  /**
   * Complete pre-calculation and batching workflow.
   * This method orchestrates:
   * 1. Pre-calculation of routing and timeline (pure functions)
   * 2. Preparation of batch execution plan
   * 3. Atomic execution of all database operations
   *
   * @param tripId - Trip ID to update
   * @param stopOrderChanges - Array of stop order changes
   * @param routingData - Pre-calculated routing data for segments
   * @param calculateTimeline - Whether to calculate timeline with routing data
   * @param startTime - Optional trip start time for timeline calculation
   * @param prismaClient - Prisma client for transaction
   * @param tripData - Optional pre-loaded trip data to avoid additional database query
   * @return Batch execution result
   */
  async executeCompleteBatch(
    tripId: string,
    stopOrderChanges: { stopId: string; newOrder: number }[],
    routingData: SegmentRoutingData[],
    calculateTimeline = true,
    startTime?: Date,
    prismaClient?: PrismaClientOrTransaction,
    tripData?: Trip,
  ): Promise<BatchResult> {
    const planningStartTime = Date.now();

    // Step 1: Load current trip data (or use provided trip data)
    const trip =
      tripData || (await this.tripService.findById(tripId, true, true, true, prismaClient));
    if (!trip || !trip.stops || trip.stops.length === 0) {
      throw new Error(`Trip ${tripId} not found or has no stops`);
    }

    // Step 2: Create execution plan using pure functions
    const plan = await this.createBatchExecutionPlan(
      trip,
      stopOrderChanges,
      routingData,
      calculateTimeline,
      startTime,
    );

    const planningTime = Date.now() - planningStartTime;
    this.logger.debug(
      `[BATCH] Planning completed in ${planningTime}ms: ${plan.stopUpdates.length} stop updates, ${plan.segmentCreationData.length} segments`,
    );

    // Step 3: Execute batch plan atomically
    const executionStartTime = Date.now();
    const result = await this.executeBatchPlan(tripId, plan, prismaClient);
    const executionTime = Date.now() - executionStartTime;

    this.logger.log(
      `[BATCH] Complete batch execution for trip ${tripId}: ${result.totalOperations} operations in ${executionTime}ms (${planningTime}ms planning)`,
    );

    return {
      ...result,
      executionTime,
      planningTime,
    };
  }

  /**
   * Create comprehensive batch execution plan using pure functions.
   * All calculations happen in memory before any database operations.
   */
  private async createBatchExecutionPlan(
    trip: Trip,
    stopOrderChanges: { stopId: string; newOrder: number }[],
    routingData: SegmentRoutingData[],
    calculateTimeline: boolean,
    startTime?: Date,
  ): Promise<BatchExecutionPlan> {
    let stopUpdates: ComprehensiveStopUpdate[] = [];
    let totalEstimatedDuration = 0;

    // Step 1: Calculate timeline with routing data if requested
    if (calculateTimeline && routingData.length > 0) {
      const timelineResult = this.timelineService.calculateTimelineWithRouting({
        stops: trip.stops || [],
        routingData,
        stopOrderChanges,
        startTime,
      });

      stopUpdates = timelineResult.stopUpdates;
      totalEstimatedDuration = timelineResult.totalTripDuration;

      this.logger.debug(
        `[BATCH] Timeline calculation: ${stopUpdates.length} stops, ${totalEstimatedDuration} minutes total`,
      );
    } else if (stopOrderChanges.length > 0) {
      // If not calculating timeline, just create order updates
      stopUpdates = stopOrderChanges.map(change => ({
        id: change.stopId,
        order: change.newOrder,
      }));
    }

    // Step 2: Create segment creation data
    const segmentCreationData = this.createSegmentCreationData(routingData, trip.id);

    // DEBUG: Log detailed information about segment creation
    this.logger.debug(`[BATCH] Segment creation debug for trip ${trip.id}:`);
    this.logger.debug(`[BATCH] - routingData.length: ${routingData.length}`);
    this.logger.debug(`[BATCH] - segmentCreationData.length: ${segmentCreationData.length}`);
    
    if (routingData.length === 0) {
      this.logger.warn(`[BATCH] No routing data available for trip ${trip.id} - segments will not be created`);
    } else {
      this.logger.debug(`[BATCH] Routing data sample for trip ${trip.id}:`);
      routingData.slice(0, 3).forEach((routing, index) => {
        this.logger.debug(`[BATCH] - Routing ${index}: ${routing.originStopId} -> ${routing.destinationStopId} (${routing.travelMode})`);
      });
    }

    return {
      routingData,
      stopUpdates,
      segmentCreationData,
      totalEstimatedDuration,
      needsRoutingRecalculation: routingData.length > 0,
      needsTimelineRecalculation: calculateTimeline,
    };
  }

  /**
   * Create segment creation data from routing information.
   * Pure function - no database operations.
   */
  private createSegmentCreationData(
    routingData: SegmentRoutingData[],
    tripId: string,
  ): Array<{
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    travelMode: TravelMode;
    distance?: number | null;
    duration?: number | null;
    apiCalculatedDistance?: number | null;
    apiCalculatedDuration?: number | null;
    polyline?: string | null;
    routeOptions?: any;
    notes?: string | null;
  }> {
    return routingData.map(routing => ({
      tripId,
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
    }));
  }

  /**
   * Execute the batch plan atomically.
   * All database operations happen here in a coordinated fashion.
   */
  private async executeBatchPlan(
    tripId: string,
    plan: BatchExecutionPlan,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Omit<BatchResult, 'executionTime' | 'planningTime'>> {
    let totalOperations = 0;
    const parallelOperations: Promise<any>[] = [];

    // Step 1: Execute stop updates in parallel if there are any
    if (plan.stopUpdates.length > 0) {
      parallelOperations.push(
        this.stopService.batchUpdateStopsComprehensive(plan.stopUpdates, prismaClient),
      );
      totalOperations += plan.stopUpdates.length;
      this.logger.debug(`[BATCH] Queued ${plan.stopUpdates.length} stop updates`);
    }

    // Step 2: Delete existing segments if we're creating new ones
    if (plan.segmentCreationData.length > 0) {
      parallelOperations.push(this.travelSegmentService.deleteByTripId(tripId, prismaClient));
      totalOperations += 1;
      this.logger.debug(`[BATCH] Queued segment deletion for trip ${tripId}`);
    } else {
      this.logger.warn(`[BATCH] No segments to create for trip ${tripId} - skipping segment deletion`);
    }

    // Execute stop updates and segment deletions in parallel
    const parallelResults = await Promise.all(parallelOperations);
    const updatedStops = plan.stopUpdates.length > 0 ? parallelResults[0] : [];

    // Step 3: Create new segments after deletions complete
    if (plan.segmentCreationData.length > 0) {
      try {
        await this.createSegmentsBatch(plan.segmentCreationData, prismaClient);
        totalOperations += plan.segmentCreationData.length;
        this.logger.debug(`[BATCH] Created ${plan.segmentCreationData.length} new segments`);
      } catch (error) {
        this.logger.error(`[BATCH] Failed to create segments for trip ${tripId}:`, error);
        throw new Error(`Failed to create travel segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      this.logger.warn(`[BATCH] No new segments created for trip ${tripId} - trip may be left without segments`);
    }

    // Step 4: Update trip dirty flags
    await this.tripService.updateTripDirtyFlags(
      tripId,
      !plan.needsRoutingRecalculation, // routing dirty = false if we just calculated it
      !plan.needsTimelineRecalculation, // timeline dirty = false if we just calculated it
      prismaClient,
    );
    totalOperations += 1;

    return {
      updatedStops,
      totalOperations,
    };
  }

  /**
   * Create travel segments in batch using createMany for optimal performance.
   * Creates segments directly from routing data pairs instead of flattening stop IDs.
   */
  private async createSegmentsBatch(
    segmentData: Array<{
      tripId: string;
      originStopId: string;
      destinationStopId: string;
      travelMode: TravelMode;
      distance?: number | null;
      duration?: number | null;
      apiCalculatedDistance?: number | null;
      apiCalculatedDuration?: number | null;
      polyline?: string | null;
      routeOptions?: any;
      notes?: string | null;
    }>,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    if (segmentData.length === 0) {
      return;
    }

    // Create segments directly from routing data pairs to avoid duplicate destination_stop_id errors
    // that can occur when flattening segment pairs into consecutive stop IDs
    const segmentCreateData = segmentData.map(data => ({
      tripId: data.tripId,
      originStopId: data.originStopId,
      destinationStopId: data.destinationStopId,
      travelMode: data.travelMode || undefined,
      distance: data.distance || undefined,
      duration: data.duration || undefined,
      apiCalculatedDistance: data.apiCalculatedDistance || undefined,
      apiCalculatedDuration: data.apiCalculatedDuration || undefined,
      polyline: data.polyline || undefined,
      routeOptions: data.routeOptions || undefined,
      notes: data.notes || undefined,
    }));

    // Use createMany for efficient batch creation
    if (prismaClient) {
      await prismaClient.travelSegment.createMany({
        data: segmentCreateData,
      });
    } else {
      // This shouldn't happen in practice since we're always in a transaction
      throw new Error('PrismaClient is required for batch segment creation');
    }
  }

  /**
   * Validate that batch execution plan is consistent and safe to execute.
   */
  validateBatchPlan(plan: BatchExecutionPlan): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate stop updates have valid IDs
    const invalidStopUpdates = plan.stopUpdates.filter(update => !update.id);
    if (invalidStopUpdates.length > 0) {
      errors.push(`${invalidStopUpdates.length} stop updates missing IDs`);
    }

    // Validate segment data has required fields
    const invalidSegments = plan.segmentCreationData.filter(
      segment => !segment.originStopId || !segment.destinationStopId,
    );
    if (invalidSegments.length > 0) {
      errors.push(`${invalidSegments.length} segments missing origin or destination IDs`);
    }

    // Validate order consistency
    const orderUpdates = plan.stopUpdates.filter(update => update.order !== undefined);
    if (orderUpdates.length > 0) {
      const orders = orderUpdates.map(update => update.order!);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('Duplicate order values found in stop updates');
      }
    }

    // Validate routing data consistency - ensure routing data exists if segments are expected
    if (plan.needsRoutingRecalculation && plan.segmentCreationData.length === 0) {
      errors.push('Routing recalculation needed but no segment creation data available');
    }

    // Check for inconsistencies between routing data and segment creation
    if (plan.routingData.length > 0 && plan.segmentCreationData.length === 0) {
      errors.push('Routing data exists but no segment creation data was generated');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== HIGH-LEVEL BATCH OPERATIONS USING ADVANCED ARCHITECTURE =====

  /**
   * Execute comprehensive stop reordering batch operation.
   * Leverages the full advanced service ecosystem for intelligent processing.
   */
  async executeReorderingBatch(
    trip: Trip,
    data: ItineraryReorderStopsDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<BatchResult> {
    const startTime = Date.now();

    this.logger.debug(
      `[ADVANCED BATCHING] Executing reordering batch for trip ${trip.id} with ${data.stopOrders.length} order changes`,
    );

    // Step 1: Comprehensive validation  
    // Note: Trip ownership validation is handled at the controller level before reaching this service
    this.sharedValidationService.validateStopOrders(data.stopOrders);

    // Step 2: Process reordering with advanced order management
    const reorderingResult = this.orderManagementService.processStopReordering({
      stops: trip.stops || [],
      newOrdering: data.stopOrders,
      preserveTimestamps: false,
      validateSequence: true,
    });

    // Step 3: Plan segments with advanced segment planning
    const planningResult = await this.segmentPlanningService.planReorderingSegments(
      trip,
      reorderingResult.reorderedStops,
      trip.matrix,
      {
        includeAllDownstream: true,
        travelMode: data.travelMode as TravelMode,
      },
    );

    // Step 4: Acquire routing data with intelligent strategy
    const routingStrategy = this.routingIntegrationService.getOptimalStrategy(
      planningResult.segmentPairs.length,
      !!trip.matrix,
      !data.calculateRouting,
      data.calculateRouting || false,
    );

    const routingResult = await this.routingIntegrationService.acquireRoutingData({
      segmentPairs: planningResult.segmentPairs,
      stops: reorderingResult.reorderedStops,
      trip,
      strategy: routingStrategy,
      travelMode: data.travelMode as TravelMode,
      matrix: trip.matrix,
    });

    // Step 5: Execute with enhanced timeline coordination
    const result = await this.executeCompleteBatch(
      trip.id,
      data.stopOrders,
      routingResult.routingData,
      true,
      undefined,
      prismaClient,
      trip,
    );

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `[ADVANCED BATCHING] Reordering batch completed: ${result.totalOperations} operations in ${totalTime}ms`,
    );

    return { ...result, executionTime: totalTime };
  }

  /**
   * Execute comprehensive stop insertion batch operation.
   * Handles validation, location processing, order management, and routing.
   */
  async executeStopInsertionBatch(
    trip: Trip,
    data: AddStopToTripDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<BatchResult> {
    const startTime = Date.now();

    this.logger.debug(
      `[ADVANCED BATCHING] Executing stop insertion batch for trip ${trip.id}`,
    );

    // Step 1: Validate location exists
    await this.sharedValidationService.validateLocationExists(data.locationId);

    // Step 2: Handle order management for insertion
    const { updates: stopOrderChanges } = this.orderManagementService.createInsertionOrderUpdates(
      trip.stops || [],
      data.insertAtOrder ?? (trip.stops?.length || 0),
    );

    // Step 3: Plan segments for insertion
    const newStopOrdering = [...(trip.stops || [])];
    newStopOrdering.splice(data.insertAtOrder ?? newStopOrdering.length, 0, {
      id: 'temp-new-stop',
      tripId: trip.id,
      locationId: data.locationId,
      order: data.insertAtOrder ?? newStopOrdering.length,
    } as any);

    const planningResult = await this.segmentPlanningService.planInsertionSegments(
      trip,
      newStopOrdering,
      data.insertAtOrder ?? newStopOrdering.length - 1,
      trip.matrix,
      {
        includeAllDownstream: true,
        travelMode: data.travelMode as TravelMode,
      },
    );

    // Step 4: Acquire routing data
    const routingStrategy = this.routingIntegrationService.getOptimalStrategy(
      planningResult.segmentPairs.length,
      !!trip.matrix,
      !data.calculateRouting,
      data.calculateRouting || false,
    );

    const routingResult = await this.routingIntegrationService.acquireRoutingData({
      segmentPairs: planningResult.segmentPairs,
      stops: newStopOrdering,
      trip,
      strategy: routingStrategy,
      travelMode: data.travelMode as TravelMode,
      matrix: trip.matrix,
    });

    // Note: This is a simplified version - actual implementation would need
    // to handle stop creation first, then execute the batch
    this.logger.warn('[ADVANCED BATCHING] Stop insertion batch - implementation pending full stop creation logic');

    const totalTime = Date.now() - startTime;
    return {
      updatedStops: [],
      totalOperations: 0,
      executionTime: totalTime,
      planningTime: 0,
    };
  }

  /**
   * Execute comprehensive stop removal batch operation.
   * Handles validation, stop deletion, order updates, and routing recalculation.
   */
  async executeStopRemovalBatch(
    trip: Trip,
    data: RemoveStopFromTripDto,
    prismaClient: PrismaClientOrTransaction,
  ): Promise<BatchResult> {
    const startTime = Date.now();

    this.logger.debug(
      `[ADVANCED BATCHING] Executing stop removal batch for trip ${trip.id}`,
    );

    // Step 1: Validate and prepare stop removal
    const stopToRemove = trip.stops?.find(stop => stop.id === data.stopId);
    if (!stopToRemove) {
      throw new Error(`Stop ${data.stopId} not found in trip ${trip.id}`);
    }

    // Step 2: Handle order management for removal
    const remainingStops = (trip.stops || []).filter(stop => stop.id !== data.stopId);
    const { updates } = this.orderManagementService.createRemovalOrderUpdates(
      remainingStops,
      stopToRemove.order,
    );

    // Step 3: Plan segments for remaining stops
    const planningRequest = {
      trip,
      operationType: 'remove' as const,
      newStopOrdering: remainingStops,
      removedStopIndex: stopToRemove.order,
      matrix: trip.matrix,
      travelMode: data.travelMode as TravelMode,
      includeAllDownstream: true,
    };

    const planningResult = await this.segmentPlanningService.planSegmentsForOperation(planningRequest);

    // Step 4: Acquire routing data for remaining segments
    const routingStrategy = this.routingIntegrationService.getOptimalStrategy(
      planningResult.segmentPairs.length,
      !!trip.matrix,
      !data.calculateRouting,
      data.calculateRouting || false,
    );

    const routingResult = await this.routingIntegrationService.acquireRoutingData({
      segmentPairs: planningResult.segmentPairs,
      stops: remainingStops,
      trip,
      strategy: routingStrategy,
      travelMode: data.travelMode as TravelMode,
      matrix: trip.matrix,
    });

    // Step 5: Delete the stop first, then execute batch updates
    await this.stopService.delete(data.stopId, prismaClient);

    let result: BatchResult;
    if (updates.length > 0 || routingResult.routingData.length > 0) {
      result = await this.executeCompleteBatch(
        trip.id,
        updates.map(update => ({ stopId: update.id, newOrder: update.order })),
        routingResult.routingData,
        true,
        undefined,
        prismaClient,
      );
    } else {
      // If no remaining stops, just update dirty flags
      await this.tripService.updateTripDirtyFlags(trip.id, false, false, prismaClient);
      result = {
        updatedStops: [],
        totalOperations: 1,
        executionTime: 0,
        planningTime: 0,
      };
    }

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `[ADVANCED BATCHING] Stop removal batch completed: ${result.totalOperations} operations in ${totalTime}ms`,
    );

    return { ...result, executionTime: totalTime };
  }
}

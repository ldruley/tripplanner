import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Stop, StopOrderUpdate, ComprehensiveStopUpdate } from '@trip-planner/types';

export interface OrderChange {
  stopId: string;
  oldOrder: number;
  newOrder: number;
  moved: boolean;
}

export interface OrderAnalysis {
  changes: OrderChange[];
  affectedStops: string[];
  earliestChangedIndex: number;
  orderShiftPattern: 'sequential' | 'scattered' | 'swap' | 'insert' | 'custom';
  hasConflicts: boolean;
  conflicts: string[];
}

export interface ReorderRequest {
  stops: Stop[];
  newOrdering: { stopId: string; newOrder: number }[];
  preserveTimestamps?: boolean;
  validateSequence?: boolean;
}

export interface ReorderResult {
  reorderedStops: Stop[];
  orderUpdates: ComprehensiveStopUpdate[];
  analysis: OrderAnalysis;
  metadata: {
    processingTime: number;
    stopsMoved: number;
    orderGaps: number[];
  };
}

@Injectable()
export class OrderManagementService {
  private readonly logger = new Logger(OrderManagementService.name);

  /**
   * Comprehensive stop reordering with analysis and validation.
   * Handles complex reordering scenarios with detailed change tracking.
   * 
   * @param request - Complete reordering request with validation options
   * @return Reordering result with analysis and metadata
   */
  processStopReordering(request: ReorderRequest): ReorderResult {
    const startTime = Date.now();
    
    this.logger.debug(
      `Processing reorder for ${request.stops.length} stops with ${request.newOrdering.length} order changes`,
    );

    // Step 1: Validate the reordering request
    this.validateReorderRequest(request);

    // Step 2: Analyze the order changes
    const analysis = this.analyzeOrderChanges(request.stops, request.newOrdering);

    // Step 3: Apply the reordering
    const reorderedStops = this.applyReordering(request.stops, request.newOrdering);

    // Step 4: Generate comprehensive stop updates
    const orderUpdates = this.generateOrderUpdates(reorderedStops, analysis, {
      preserveTimestamps: request.preserveTimestamps,
    });

    // Step 5: Calculate metadata
    const metadata = this.calculateReorderMetadata(analysis, startTime);

    this.logger.log(
      `Reordering completed: ${metadata.stopsMoved} stops moved, pattern: ${analysis.orderShiftPattern}`,
    );

    return {
      reorderedStops,
      orderUpdates,
      analysis,
      metadata,
    };
  }

  /**
   * Analyze order changes to understand the reordering pattern.
   * Pure function that provides detailed insights into the reordering operation.
   */
  private analyzeOrderChanges(stops: Stop[], newOrdering: { stopId: string; newOrder: number }[]): OrderAnalysis {
    const changes: OrderChange[] = [];
    const orderMap = new Map(newOrdering.map(item => [item.stopId, item.newOrder]));
    const originalOrderMap = new Map(stops.map(stop => [stop.id as string, stop.order]));
    const conflicts: string[] = [];
    
    // Analyze each stop's order change
    for (const stop of stops) {
      const newOrder = orderMap.get(stop.id as string);
      const oldOrder = stop.order;
      
      if (newOrder !== undefined) {
        changes.push({
          stopId: stop.id as string,
          oldOrder,
          newOrder,
          moved: oldOrder !== newOrder,
        });
      }
    }

    // Check for order conflicts (duplicate orders)
    const newOrders = newOrdering.map(item => item.newOrder);
    const orderCounts = new Map<number, number>();
    for (const order of newOrders) {
      orderCounts.set(order, (orderCounts.get(order) || 0) + 1);
    }
    
    for (const [order, count] of orderCounts.entries()) {
      if (count > 1) {
        conflicts.push(`Duplicate order ${order} assigned to ${count} stops`);
      }
    }

    // Find earliest changed index
    const movedChanges = changes.filter(c => c.moved).sort((a, b) => Math.min(a.oldOrder, a.newOrder) - Math.min(b.oldOrder, b.newOrder));
    const earliestChangedIndex = movedChanges.length > 0 
      ? Math.min(...movedChanges.map(c => Math.min(c.oldOrder, c.newOrder)))
      : -1;

    // Determine order shift pattern
    const orderShiftPattern = this.determineOrderShiftPattern(changes);

    return {
      changes,
      affectedStops: changes.filter(c => c.moved).map(c => c.stopId),
      earliestChangedIndex,
      orderShiftPattern,
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Determine the pattern of order changes for optimization and debugging.
   * Pure function that classifies the type of reordering operation.
   */
  private determineOrderShiftPattern(changes: OrderChange[]): OrderAnalysis['orderShiftPattern'] {
    const movedChanges = changes.filter(c => c.moved);
    
    if (movedChanges.length === 0) {
      return 'sequential';
    }
    
    if (movedChanges.length === 2) {
      // Check if it's a simple swap
      const [change1, change2] = movedChanges;
      if (change1.newOrder === change2.oldOrder && change2.newOrder === change1.oldOrder) {
        return 'swap';
      }
    }
    
    // Check if it's a sequential shift (all changes are consecutive)
    const sortedByOldOrder = [...movedChanges].sort((a, b) => a.oldOrder - b.oldOrder);
    let isSequential = true;
    for (let i = 1; i < sortedByOldOrder.length; i++) {
      if (sortedByOldOrder[i].oldOrder !== sortedByOldOrder[i - 1].oldOrder + 1) {
        isSequential = false;
        break;
      }
    }
    
    if (isSequential) {
      // Check if all changes shift in the same direction
      const allShiftUp = movedChanges.every(c => c.newOrder > c.oldOrder);
      const allShiftDown = movedChanges.every(c => c.newOrder < c.oldOrder);
      
      if (allShiftUp || allShiftDown) {
        return 'insert';
      }
    }
    
    // Check if changes are scattered
    const orderSpread = Math.max(...movedChanges.map(c => c.oldOrder)) - Math.min(...movedChanges.map(c => c.oldOrder));
    const changeCount = movedChanges.length;
    
    if (orderSpread > changeCount * 2) {
      return 'scattered';
    }
    
    return 'custom';
  }

  /**
   * Apply reordering to stops array.
   * Pure function that creates new stop array with updated orders.
   */
  private applyReordering(stops: Stop[], newOrdering: { stopId: string; newOrder: number }[]): Stop[] {
    const orderMap = new Map(newOrdering.map(item => [item.stopId, item.newOrder]));
    
    const reorderedStops = stops.map(stop => {
      const newOrder = orderMap.get(stop.id as string);
      if (newOrder !== undefined) {
        return { ...stop, order: newOrder };
      }
      return stop;
    });
    
    // Sort by new order
    return reorderedStops.sort((a, b) => a.order - b.order);
  }

  /**
   * Generate comprehensive stop updates from reordering analysis.
   * Creates update objects that can be used by the batch update system.
   */
  private generateOrderUpdates(
    reorderedStops: Stop[],
    analysis: OrderAnalysis,
    options: { preserveTimestamps?: boolean } = {},
  ): ComprehensiveStopUpdate[] {
    const updates: ComprehensiveStopUpdate[] = [];
    
    for (const change of analysis.changes) {
      if (change.moved) {
        const update: ComprehensiveStopUpdate = {
          id: change.stopId,
          order: change.newOrder,
        };
        
        // Optionally preserve timestamps or clear calculated times for recalculation
        if (!options.preserveTimestamps) {
          update.calculatedArrivalTime = undefined;
          update.calculatedDepartureTime = undefined;
        }
        
        updates.push(update);
      }
    }
    
    return updates;
  }

  /**
   * Calculate metadata about the reordering operation.
   * Provides insights for performance monitoring and debugging.
   */
  private calculateReorderMetadata(analysis: OrderAnalysis, startTime: number): ReorderResult['metadata'] {
    const processingTime = Date.now() - startTime;
    const stopsMoved = analysis.changes.filter(c => c.moved).length;
    
    // Calculate order gaps (places where order sequence is not consecutive)
    const allOrders = analysis.changes.map(c => c.newOrder).sort((a, b) => a - b);
    const orderGaps: number[] = [];
    
    for (let i = 1; i < allOrders.length; i++) {
      const gap = allOrders[i] - allOrders[i - 1];
      if (gap > 1) {
        orderGaps.push(gap - 1);
      }
    }
    
    return {
      processingTime,
      stopsMoved,
      orderGaps,
    };
  }

  /**
   * Validate reordering request for consistency and completeness.
   * Throws BadRequestException for invalid requests.
   */
  private validateReorderRequest(request: ReorderRequest): void {
    const { stops, newOrdering, validateSequence = true } = request;
    
    if (stops.length === 0) {
      throw new BadRequestException('Cannot reorder empty stops array');
    }
    
    if (newOrdering.length === 0) {
      throw new BadRequestException('New ordering cannot be empty');
    }
    
    // Check that all stop IDs in new ordering exist in stops
    const stopIds = new Set(stops.map(stop => stop.id));
    const orderingStopIds = new Set(newOrdering.map(item => item.stopId));
    
    for (const orderingStopId of orderingStopIds) {
      if (!stopIds.has(orderingStopId)) {
        throw new BadRequestException(`Stop ID ${orderingStopId} in new ordering not found in stops array`);
      }
    }
    
    // Validate that orders are non-negative
    for (const item of newOrdering) {
      if (item.newOrder < 0) {
        throw new BadRequestException(`Negative order not allowed: ${item.newOrder} for stop ${item.stopId}`);
      }
    }
    
    // Validate sequence if requested
    if (validateSequence) {
      this.validateOrderSequence(newOrdering);
    }
  }

  /**
   * Validate that order sequence is proper (no duplicates, reasonable gaps).
   * Can be disabled for flexible reordering scenarios.
   */
  private validateOrderSequence(newOrdering: { stopId: string; newOrder: number }[]): void {
    const orders = newOrdering.map(item => item.newOrder);
    const uniqueOrders = new Set(orders);
    
    if (orders.length !== uniqueOrders.size) {
      throw new BadRequestException('Duplicate orders detected in new ordering');
    }
    
    const sortedOrders = [...orders].sort((a, b) => a - b);
    const maxGap = Math.max(...sortedOrders.slice(1).map((order, i) => order - sortedOrders[i]));
    
    // Warn about large gaps but don't fail (might be intentional)
    if (maxGap > 10) {
      this.logger.warn(`Large gap detected in order sequence: ${maxGap}`);
    }
  }

  /**
   * Create order updates for stop insertion.
   * Handles reordering of existing stops to make room for new stop.
   */
  createInsertionOrderUpdates(
    existingStops: Stop[],
    insertAtOrder: number,
  ): { updates: StopOrderUpdate[]; reorderedStops: Stop[] } {
    const updates: StopOrderUpdate[] = [];
    const reorderedStops: Stop[] = [];
    
    for (const stop of existingStops) {
      if (stop.order >= insertAtOrder) {
        // Shift this stop down to make room
        const newOrder = stop.order + 1;
        updates.push({
          id: stop.id as string,
          order: newOrder,
        });
        reorderedStops.push({ ...stop, order: newOrder });
      } else {
        reorderedStops.push(stop);
      }
    }
    
    this.logger.debug(`Created ${updates.length} order updates for insertion at order ${insertAtOrder}`);
    
    return { updates, reorderedStops };
  }

  /**
   * Create order updates for stop removal.
   * Handles reordering of remaining stops to close gaps.
   */
  createRemovalOrderUpdates(
    remainingStops: Stop[],
    removedStopOrder: number,
  ): { updates: StopOrderUpdate[]; reorderedStops: Stop[] } {
    const updates: StopOrderUpdate[] = [];
    const reorderedStops: Stop[] = [];
    
    for (const stop of remainingStops) {
      if (stop.order > removedStopOrder) {
        // Shift this stop up to close the gap
        const newOrder = stop.order - 1;
        updates.push({
          id: stop.id as string,
          order: newOrder,
        });
        reorderedStops.push({ ...stop, order: newOrder });
      } else {
        reorderedStops.push(stop);
      }
    }
    
    this.logger.debug(`Created ${updates.length} order updates for removal at order ${removedStopOrder}`);
    
    return { updates, reorderedStops };
  }

  /**
   * Normalize stop orders to eliminate gaps and ensure consecutive sequence.
   * Useful for cleanup and optimization.
   */
  normalizeStopOrders(stops: Stop[]): { updates: StopOrderUpdate[]; normalizedStops: Stop[] } {
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const updates: StopOrderUpdate[] = [];
    const normalizedStops: Stop[] = [];
    
    for (let i = 0; i < sortedStops.length; i++) {
      const stop = sortedStops[i];
      const normalizedOrder = i; // 0-based consecutive ordering
      
      if (stop.order !== normalizedOrder) {
        updates.push({
          id: stop.id as string,
          order: normalizedOrder,
        });
      }
      
      normalizedStops.push({ ...stop, order: normalizedOrder });
    }
    
    this.logger.debug(`Normalized ${stops.length} stops, ${updates.length} order changes needed`);
    
    return { updates, normalizedStops };
  }

  /**
   * Compare two stop orderings to identify differences.
   * Useful for testing and change analysis.
   */
  compareOrderings(
    original: Stop[],
    modified: Stop[],
  ): {
    differences: OrderChange[];
    summary: {
      totalChanges: number;
      positionSwaps: number;
      orderShifts: number;
    };
  } {
    const originalMap = new Map(original.map(stop => [stop.id as string, stop.order]));
    const differences: OrderChange[] = [];
    let positionSwaps = 0;
    let orderShifts = 0;
    
    for (const stop of modified) {
      const originalOrder = originalMap.get(stop.id as string);
      if (originalOrder !== undefined && originalOrder !== stop.order) {
        differences.push({
          stopId: stop.id as string,
          oldOrder: originalOrder,
          newOrder: stop.order,
          moved: true,
        });
        
        // Classify the type of change
        const orderDiff = Math.abs(stop.order - originalOrder);
        if (orderDiff === 1) {
          positionSwaps++;
        } else {
          orderShifts++;
        }
      }
    }
    
    return {
      differences,
      summary: {
        totalChanges: differences.length,
        positionSwaps,
        orderShifts,
      },
    };
  }
}
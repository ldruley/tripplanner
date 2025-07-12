import { z } from 'zod';
import { TravelModeSchema } from './travel-segment.schema';
import { StopType } from '@prisma/client';
import { StopTypeSchema } from './stop.schema';

// Schema for routing data used in batching operations
export const SegmentRoutingDataSchema = z.object({
  originStopId: z.string().uuid().describe('ID of the origin stop'),
  destinationStopId: z.string().uuid().describe('ID of the destination stop'),
  travelMode: TravelModeSchema.describe('Travel mode for the segment'),
  apiCalculatedDistance: z
    .number()
    .nullable()
    .describe('Distance calculated by routing API (meters)'),
  apiCalculatedDuration: z
    .number()
    .nullable()
    .describe('Duration calculated by routing API (minutes)'),
  polyline: z.string().nullable().describe('Encoded polyline geometry from routing API'),
});

// Schema for comprehensive stop updates
export const ComprehensiveStopUpdateSchema = z.object({
  id: z.string().uuid().describe('ID of the stop to update'),
  order: z.number().int().min(0).optional().describe('New order position for the stop'),
  calculatedArrivalTime: z.coerce.date().optional().describe('Calculated arrival time'),
  calculatedDepartureTime: z.coerce.date().optional().describe('Calculated departure time'),
  plannedArrivalTime: z.coerce.date().nullable().optional().describe('User-planned arrival time'),
  plannedDuration: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe('User-planned duration (minutes)'),
  stopType: StopTypeSchema.nullable().optional(),
  notes: z.string().nullable().optional().describe('Notes for the stop'),
  alias: z.string().nullable().optional().describe('Custom alias for the stop'),
});

// Schema for batch execution plan
export const BatchExecutionPlanSchema = z.object({
  routingData: z.array(SegmentRoutingDataSchema).describe('Pre-calculated routing data'),
  stopUpdates: z.array(ComprehensiveStopUpdateSchema).describe('Comprehensive stop updates'),
  segmentCreationData: z
    .array(
      z.object({
        tripId: z.string().uuid(),
        originStopId: z.string().uuid(),
        destinationStopId: z.string().uuid(),
        travelMode: TravelModeSchema,
        distance: z.number().nullable().optional(),
        duration: z.number().nullable().optional(),
        apiCalculatedDistance: z.number().nullable().optional(),
        apiCalculatedDuration: z.number().nullable().optional(),
        polyline: z.string().nullable().optional(),
        routeOptions: z.any().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .describe('Data for creating travel segments'),
  totalEstimatedDuration: z.number().describe('Total estimated trip duration (minutes)'),
  needsRoutingRecalculation: z.boolean().describe('Whether routing recalculation is needed'),
  needsTimelineRecalculation: z.boolean().describe('Whether timeline recalculation is needed'),
});

// Schema for batch execution result
export const BatchResultSchema = z.object({
  updatedStops: z.array(z.any()).describe('Array of updated stop records'), // Using any for Stop type
  totalOperations: z.number().describe('Total number of database operations performed'),
  executionTime: z.number().describe('Time taken for execution (milliseconds)'),
  planningTime: z.number().describe('Time taken for planning (milliseconds)'),
});

// Schema for timeline with routing request
export const TimelineWithRoutingRequestSchema = z.object({
  stops: z.array(z.any()).describe('Array of stops'), // Using any for Stop type
  routingData: z.array(SegmentRoutingDataSchema).describe('Routing data for segments'),
  stopOrderChanges: z
    .array(
      z.object({
        stopId: z.string().uuid(),
        newOrder: z.number().int().min(0),
      }),
    )
    .optional()
    .describe('Optional stop order changes'),
  startTime: z.coerce.date().optional().describe('Optional trip start time'),
});

// Schema for timeline with routing result
export const TimelineWithRoutingResultSchema = z.object({
  stopUpdates: z
    .array(ComprehensiveStopUpdateSchema)
    .describe('Comprehensive stop updates with calculated times'),
  totalTripDuration: z.number().describe('Total trip duration (minutes)'),
  tripStartTime: z.coerce.date().optional().describe('Trip start time'),
  tripEndTime: z.coerce.date().optional().describe('Trip end time'),
  hasConflicts: z.boolean().describe('Whether there are scheduling conflicts'),
});

// Type exports
export type SegmentRoutingData = z.infer<typeof SegmentRoutingDataSchema>;
export type ComprehensiveStopUpdate = z.infer<typeof ComprehensiveStopUpdateSchema>;
export type BatchExecutionPlan = z.infer<typeof BatchExecutionPlanSchema>;
export type BatchResult = z.infer<typeof BatchResultSchema>;
export type TimelineWithRoutingRequest = z.infer<typeof TimelineWithRoutingRequestSchema>;
export type TimelineWithRoutingResult = z.infer<typeof TimelineWithRoutingResultSchema>;

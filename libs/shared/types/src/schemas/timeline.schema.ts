import { z } from 'zod';
import { StopSchema } from './stop.schema';
import { TravelSegmentSchema } from './travel-segment.schema';

export const TimelineCalculationRequestSchema = z.object({
  stops: z.array(StopSchema),
  segments: z.array(TravelSegmentSchema),
  startTime: z.coerce.date().optional(),
});

export const TimelineCalculationResultSchema = z.object({
  updatedStops: z.array(StopSchema),
  totalTripDuration: z.number(), // in minutes
  tripStartTime: z.coerce.date().optional(),
  tripEndTime: z.coerce.date().optional(),
  hasConflicts: z.boolean(),
});

export type TimelineCalculationRequest = z.infer<typeof TimelineCalculationRequestSchema>;
export type TimelineCalculationResult = z.infer<typeof TimelineCalculationResultSchema>;

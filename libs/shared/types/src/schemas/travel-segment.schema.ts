import { z } from 'zod';
import { uuidSchema } from './base.schema';
import { TravelMode } from '@prisma/client';

export const TravelModeSchema = z.nativeEnum(TravelMode);

export const TravelSegmentSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  originStopId: uuidSchema,
  destinationStopId: uuidSchema,
  
  travelMode: TravelModeSchema.nullable().optional(),
  distance: z.number().nullable().optional(),
  duration: z.number().int().nullable().optional(), // minutes from API
  
  apiCalculatedDistance: z.number().nullable().optional(),
  apiCalculatedDuration: z.number().int().nullable().optional(), // primary source
  polyline: z.string().nullable().optional(),
  routeOptions: z.any().nullable().optional(),
  notes: z.string().nullable().optional(),
  
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateTravelSegmentSchema = TravelSegmentSchema.pick({
  tripId: true,
  originStopId: true,
  destinationStopId: true,
  travelMode: true,
  distance: true,
  duration: true,
  apiCalculatedDistance: true,
  apiCalculatedDuration: true,
  polyline: true,
  routeOptions: true,
  notes: true,
});

export const UpdateTravelSegmentSchema = TravelSegmentSchema.pick({
  travelMode: true,
  distance: true,
  duration: true,
  apiCalculatedDistance: true,
  apiCalculatedDuration: true,
  polyline: true,
  routeOptions: true,
  notes: true,
}).partial();

export const UpdateTravelSegmentNotesSchema = TravelSegmentSchema.pick({
  notes: true,
});

export const TravelSegmentSearchSchema = z.object({
  tripId: uuidSchema.optional(),
  originStopId: uuidSchema.optional(),
  destinationStopId: uuidSchema.optional(),
  travelMode: TravelModeSchema.optional(),
});

export const BulkTravelSegmentUpdateSchema = z.object({
  tripId: uuidSchema,
  updates: z.array(
    z.object({
      id: uuidSchema,
      travelMode: TravelModeSchema.nullable().optional(),
      distance: z.number().nullable().optional(),
      duration: z.number().int().nullable().optional(),
      apiCalculatedDistance: z.number().nullable().optional(),
      apiCalculatedDuration: z.number().int().nullable().optional(),
      polyline: z.string().nullable().optional(),
      routeOptions: z.any().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  ),
});

export type TravelSegment = z.infer<typeof TravelSegmentSchema>;
export type CreateTravelSegmentRequest = z.infer<typeof CreateTravelSegmentSchema>;
export type UpdateTravelSegmentRequest = z.infer<typeof UpdateTravelSegmentSchema>;
export type UpdateTravelSegmentNotesRequest = z.infer<typeof UpdateTravelSegmentNotesSchema>;
export type TravelSegmentSearchCriteria = z.infer<typeof TravelSegmentSearchSchema>;
export type BulkTravelSegmentUpdateRequest = z.infer<typeof BulkTravelSegmentUpdateSchema>;
import { z } from 'zod';
import { uuidSchema } from './base.schema';
import { TravelMode } from '@prisma/client';
import { StopWithLocationSchema } from './stop.schema';

export const TravelModeSchema = z.nativeEnum(TravelMode);

export const TravelSegmentSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  originStopId: uuidSchema,
  destinationStopId: uuidSchema,
  travelMode: TravelModeSchema.nullable().optional(),
  distance: z
    .number()
    .min(0, { message: 'Distance must be at least 0 meters' })
    .nullable()
    .optional(),
  duration: z
    .number()
    .int()
    .min(0, { message: 'Duration must be at least 0 minutes' })
    .nullable()
    .optional(),
  apiCalculatedDistance: z
    .number()
    .min(0, { message: 'API calculated distance must be at least 0 meters' })
    .nullable()
    .optional(),
  apiCalculatedDuration: z
    .number()
    .int()
    .min(0, { message: 'API calculated duration must be at least 0 minutes' })
    .nullable()
    .optional(),
  polyline: z.string().nullable().optional(),
  routeOptions: z.any().nullable().optional(),
  notes: z
    .string()
    .max(1000, { message: 'Notes cannot exceed 1000 characters' })
    .nullable()
    .optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateTravelSegmentSchema = TravelSegmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export const UpdateTravelApiCalculatedDataSchema = z
  .object({
    id: uuidSchema,
    apiCalculatedDistance: z
      .number()
      .min(0, { message: 'API calculated distance must be at least 0 meters' }),
    apiCalculatedDuration: z
      .number()
      .int()
      .min(0, { message: 'API calculated duration must be at least 0 minutes' }),
    polyline: z.string(),
  })
  .required();

export const UpdateTravelSegmentNotesSchema = TravelSegmentSchema.pick({ notes: true });

export const TravelSegmentSearchSchema = TravelSegmentSchema.pick({
  tripId: true,
  originStopId: true,
  destinationStopId: true,
  travelMode: true,
}).partial();

export const BulkTravelSegmentUpdateSchema = z.object({
  tripId: uuidSchema,
  updates: z
    .array(
      TravelSegmentSchema.pick({
        id: true,
        travelMode: true,
        distance: true,
        duration: true,
        apiCalculatedDistance: true,
        apiCalculatedDuration: true,
        polyline: true,
        routeOptions: true,
        notes: true,
      })
        .partial()
        .refine(data => !!data.id, { message: 'id is required for each update' }),
    )
    .min(1, { message: 'At least one update is required' }),
});

export const UpdateTravelSegmentRoutingDataSchema = z.object({
  travelMode: TravelModeSchema,
  distanceMeters: z.number().min(0, { message: 'Distance must be at least 0 meters' }),
  durationSeconds: z.number().min(0, { message: 'Duration must be at least 0 seconds' }),
  polyline: z.string().optional(),
  provider: z.enum(['HERE', 'MAPBOX'], { message: 'Provider must be either HERE or MAPBOX' }),
});

export const TravelSegmentWithStopsSchema = TravelSegmentSchema.extend({
  originStop: StopWithLocationSchema,
  destinationStop: StopWithLocationSchema,
});

// Types
export type TravelSegment = z.infer<typeof TravelSegmentSchema>;
export type TravelSegmentWithStops = z.infer<typeof TravelSegmentWithStopsSchema>;
export type CreateTravelSegmentRequest = z.infer<typeof CreateTravelSegmentSchema>;
export type UpdateTravelSegmentRequest = z.infer<typeof UpdateTravelSegmentSchema>;
export type UpdateTravelSegmentNotesRequest = z.infer<typeof UpdateTravelSegmentNotesSchema>;
export type TravelSegmentSearchCriteria = z.infer<typeof TravelSegmentSearchSchema>;
export type BulkTravelSegmentUpdateRequest = z.infer<typeof BulkTravelSegmentUpdateSchema>;
export type UpdateTravelSegmentRoutingData = z.infer<typeof UpdateTravelSegmentRoutingDataSchema>;
export type UpdateTravelApiCalculatedData = z.infer<typeof UpdateTravelApiCalculatedDataSchema>;

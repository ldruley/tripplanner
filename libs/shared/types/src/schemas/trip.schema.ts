import { z } from 'zod';
import { StopSchema } from './stop.schema';
import { TravelSegmentSchema } from './travel-segment.schema';
import { TripBankedLocationSchema } from './trip-banked-location.schema';
import { uuidSchema } from './base.schema';

export const TripSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  
  // Relations (optional for some use cases)
  stops: z.array(StopSchema).optional().default([]),
  bankedLocations: z.array(TripBankedLocationSchema).optional().default([]),
  travelSegments: z.array(TravelSegmentSchema).optional().default([]),
});

export const CreateTripRequestSchema = TripSchema.pick({
  name: true,
  description: true,
  startDate: true,
  endDate: true,
});

export const UpdateTripRequestSchema = TripSchema.pick({
  name: true,
  description: true,
}).partial();

export const TripServiceUpdateRequestSchema = TripSchema.pick({
  name: true,
  description: true,
  startDate: true,
  endDate: true,
}).partial();

export const TripSearchCriteriaSchema = z.object({
  userId: uuidSchema.optional(),
  name: z.string().optional(),
  includeStops: z.boolean().optional().default(false),
  includeBankedLocations: z.boolean().optional().default(false),
  includeTravelSegments: z.boolean().optional().default(false),
});

export type Trip = z.infer<typeof TripSchema>;
export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;
export type UpdateTripRequest = z.infer<typeof UpdateTripRequestSchema>;
export type TripServiceUpdateRequest = z.infer<typeof TripServiceUpdateRequestSchema>;
export type TripSearchCriteria = z.infer<typeof TripSearchCriteriaSchema>;

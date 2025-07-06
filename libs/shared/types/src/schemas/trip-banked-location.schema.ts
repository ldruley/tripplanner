import { z } from 'zod';
import { uuidSchema } from './base.schema';
import { LocationSchema } from './location.schema';

export const TripBankedLocationSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  locationId: uuidSchema,
  addedAt: z.coerce.date(),

  // Relations
  location: LocationSchema.optional(),
});

export const CreateTripBankedLocationRequestSchema = TripBankedLocationSchema.pick({
  tripId: true,
  locationId: true,
});

export const TripBankedLocationSearchCriteriaSchema = z.object({
  tripId: uuidSchema.optional(),
  locationId: uuidSchema.optional(),
  includeTrip: z.boolean().optional().default(false),
  includeLocation: z.boolean().optional().default(false),
});

export type TripBankedLocation = z.infer<typeof TripBankedLocationSchema>;
export type CreateTripBankedLocationRequest = z.infer<typeof CreateTripBankedLocationRequestSchema>;
export type TripBankedLocationSearchCriteria = z.infer<typeof TripBankedLocationSearchCriteriaSchema>;

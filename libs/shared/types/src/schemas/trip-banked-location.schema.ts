import { z } from 'zod';
import { uuidSchema } from './base.schema';
import { LocationSchema } from './location.schema';
import { extendApi } from '@anatine/zod-openapi';
import { createZodDto } from '@anatine/zod-nestjs';

export const TripBankedLocationSchema = extendApi(
  z.object({
    id: uuidSchema,
    tripId: uuidSchema,
    locationId: uuidSchema,
    createdAt: z.coerce.date(),

    // Relations
    location: LocationSchema.optional(),
  }),
  {
    title: 'TripBankedLocation',
    description: 'Represents a location banked for a specific trip.',
  },
);

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
export type TripBankedLocationSearchCriteria = z.infer<
  typeof TripBankedLocationSearchCriteriaSchema
>;

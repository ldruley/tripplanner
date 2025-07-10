import { z } from 'zod';

export const AddLocationToBankSchema = z.object({
  locationId: z.string().uuid('Location ID must be a valid UUID'),
});

// Schema for removing a location from bank
export const RemoveLocationFromBankSchema = z.object({
  locationId: z.string().uuid('Location ID must be a valid UUID'),
});

// Schema for promoting a banked location to a stop
export const PromoteLocationToStopSchema = z.object({
  locationId: z.string().uuid('Location ID must be a valid UUID'),
  position: z.number().int().min(0).optional(),
});

// Schema for banked location response
export const TripBankedLocationSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  locationId: z.string().uuid(),
  createdAt: z.date(),
  location: z.object({
    id: z.string().uuid(),
    name: z.string(),
    address: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    googlePlaceId: z.string().nullable(),
    hereId: z.string().nullable(),
    mapboxId: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export type AddLocationToBankRequest = z.infer<typeof AddLocationToBankSchema>;
export type RemoveLocationFromBankRequest = z.infer<typeof RemoveLocationFromBankSchema>;
export type PromoteLocationToStopRequest = z.infer<typeof PromoteLocationToStopSchema>;
export type TripBankedLocationResponse = z.infer<typeof TripBankedLocationSchema>;

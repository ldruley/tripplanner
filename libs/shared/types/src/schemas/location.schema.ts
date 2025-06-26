//Draft version of the location schema, to be updated when we finalize backend specs

import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './base.schema';

// Main schema
export const LocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),

  // Location coordinates
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  // Denormalized address
  fullAddress: z.string().nullable(),

  // Granular address
  addressLine1: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  state: z.string().max(100).nullable(),
  country: z.string().max(100).nullable(),
  postalCode: z.string().max(20).nullable(),

  // Geocoding details
  geocodingProvider: z.enum(['mapbox', 'google', 'here', 'manual']).nullable(),
  geocodingProviderId: z.string().nullable(),
  geocodedAt: z.coerce.date().nullable(),

  // Standard database timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Type Exports
export type Location = z.infer<typeof LocationSchema>;

//Draft version of the location schema, to be updated when we finalize backend specs

import { z } from 'zod';

// Main schema
export const LocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  address: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  postal_code: z.string().min(1).max(20).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
});

// Type Exports
export type Location = z.infer<typeof LocationSchema>;

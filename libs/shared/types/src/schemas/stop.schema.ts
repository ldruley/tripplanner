// Draft version of the stop schema, to be updated when we finalize backend specs

import { z } from 'zod';

// Main schema
export const StopSchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  order: z.number().int().min(0),
  arrivalTime: z.coerce.date().nullable().optional(),
  departureTime: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  locationDetails: z.object({ // Simplified embedded location for now
    id: z.string().uuid(),
    name: z.string(),
    address: z.string().max(500).optional(),
  }).optional(),
});

export type Stop = z.infer<typeof StopSchema>;

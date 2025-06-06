// Draft version of the stop schema, to be updated when we finalize backend specs

import { z } from 'zod';
import { LocationSchema} from './location.schema';
import { uuidSchema } from './base.schema';
// Main schema
export const StopSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  order: z.number().int().min(0),
  arrivalTime: z.coerce.date().nullable().optional(),
  departureTime: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date().nullable().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
  locationDetails: LocationSchema,
  locationId: z.string().uuid()
});

export type Stop = z.infer<typeof StopSchema>;

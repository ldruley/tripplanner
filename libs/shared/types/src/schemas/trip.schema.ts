// Initial version of the trip schema, to be updated when we finalize backend specs

import { z } from 'zod';
import { StopSchema } from './stop.schema';

export const TripSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  stops: z.array(StopSchema).optional().default([]),
  created_at: z.coerce.date().nullable().optional(),
  updated_at: z.coerce.date().nullable().optional(),
});

export type Trip = z.infer<typeof TripSchema>;

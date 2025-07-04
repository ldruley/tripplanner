import { z } from 'zod';
import { StopSchema } from './stop.schema';
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
  bankedLocations: z.array(z.any()).optional().default([]),
});

export type Trip = z.infer<typeof TripSchema>;

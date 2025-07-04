import { z } from 'zod';
import { LocationSchema } from './location.schema';
import { uuidSchema } from './base.schema';

export const StopSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  locationId: uuidSchema,
  order: z.number().int().min(0),
  
  // Timing fields to match Prisma
  plannedArrivalTime: z.coerce.date().nullable().optional(),
  plannedDuration: z.number().int().nullable().optional(), // minutes - user controlled
  calculatedArrivalTime: z.coerce.date().nullable().optional(),
  calculatedDepartureTime: z.coerce.date().nullable().optional(),
  
  stopType: z.enum(['PITSTOP', 'OVERNIGHT']).nullable().optional(),
  notes: z.string().nullable().optional(),
  
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  
  // Relations
  location: LocationSchema.optional(),
});

export type Stop = z.infer<typeof StopSchema>;

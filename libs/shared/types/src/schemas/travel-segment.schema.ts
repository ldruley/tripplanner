import { z } from 'zod';
import { uuidSchema } from './base.schema';

export const TravelSegmentSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  originStopId: uuidSchema,
  destinationStopId: uuidSchema,
  
  travelMode: z.enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT', 'PUBLIC_TRANSPORT']).nullable().optional(),
  distance: z.number().nullable().optional(),
  duration: z.number().int().nullable().optional(), // minutes from API
  
  apiCalculatedDistance: z.number().nullable().optional(),
  apiCalculatedDuration: z.number().int().nullable().optional(), // primary source
  polyline: z.string().nullable().optional(),
  routeOptions: z.any().nullable().optional(),
  notes: z.string().nullable().optional(),
  
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TravelSegment = z.infer<typeof TravelSegmentSchema>;
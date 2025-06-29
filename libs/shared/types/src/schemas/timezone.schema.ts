import {z} from 'zod';
import { citySchema, latitudeSchema, longitudeSchema } from './base.schema';

//TODO: Remove city since that's a premium feature and this is messy anyway
export const TimezoneRequestSchema = z.object({
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  city: citySchema.optional(),
  requestId: z.string().uuid().optional(),
}).refine((data) => {
  const hasCoords = !!data.latitude && !!data.longitude;
  const hasCity = !!data.city;
  return hasCoords !== hasCity;
})


export const TimezoneResponseSchema = z.object({
  timezone: z.string().min(1),
  requestId: z.string().uuid(),
});

export type TimezoneRequest = z.infer<typeof TimezoneRequestSchema>;
export type TimezoneResponse = z.infer<typeof TimezoneResponseSchema>;

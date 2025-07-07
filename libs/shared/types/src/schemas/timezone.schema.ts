import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { citySchema, latitudeSchema, longitudeSchema } from './base.schema';

//TODO: Remove city since that's a premium feature and this is messy anyway
export const TimezoneRequestSchema = extendApi(
  z
    .object({
      latitude: latitudeSchema.optional().describe('Latitude for timezone lookup'),
      longitude: longitudeSchema.optional().describe('Longitude for timezone lookup'),
      city: citySchema.optional().describe('City name for timezone lookup (premium feature)'),
      requestId: z.string().uuid().optional().describe('Optional request ID for tracking'),
    })
    .refine(data => {
      const hasCoords = !!data.latitude && !!data.longitude;
      const hasCity = !!data.city;
      return hasCoords !== hasCity;
    }, {
      message: 'Must provide either coordinates (latitude and longitude) or city, but not both',
    }),
  {
    title: 'Timezone Request',
    description: 'Request schema for timezone lookup by coordinates or city',
    example: {
      latitude: 48.8566,
      longitude: 2.3522,
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    },
  },
);

export const TimezoneResponseSchema = extendApi(
  z.object({
    timezone: z.string().min(1).describe('IANA timezone identifier (e.g., "Europe/Paris")'),
    requestId: z.string().uuid().describe('Request ID that matches the original request'),
  }),
  {
    title: 'Timezone Response',
    description: 'Response schema for timezone lookup results',
    example: {
      timezone: 'Europe/Paris',
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    },
  },
);

export type TimezoneRequest = z.infer<typeof TimezoneRequestSchema>;
export type TimezoneResponse = z.infer<typeof TimezoneResponseSchema>;

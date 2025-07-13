import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { BaseLocationResultSchema, GeoProviderSchema } from './base.schema';

export const GeocodingResultSchema = extendApi(
  BaseLocationResultSchema.omit({ name: true }).extend({
    timezone: z.string().nullable().optional().describe('Timezone of the location'),
    provider: GeoProviderSchema.describe('The service that provided this geocoding result.'),
    rawResponse: z.any().optional().describe('Raw response from the provider (optional)'),
  }),
  {
    description: 'A single geocoding result with standardized and provider-specific fields.',
    example: {
      latitude: 52.52,
      longitude: 13.405,
      fullAddress: 'Pariser Platz, 10117 Berlin, Germany',
      streetAddress: 'Pariser Platz',
      city: 'Berlin',
      region: 'Berlin',
      country: 'Germany',
      postalCode: '10117',
      provider: 'mapbox',
      providerId: 'mbx123',
      rawResponse: {},
    },
  },
);

export const ForwardGeocodeQuerySchema = extendApi(
  z.object({
    search: z
      .string()
      .min(3, { message: 'Search query must be at least 3 characters.' })
      .describe('The search string to geocode (minimum 3 characters)'),
  }),
  {
    description: 'Query schema for forward geocoding (address to coordinates)',
    example: {
      search: 'Pariser Platz Berlin',
    },
  },
);

export const ReverseGeocodeQuerySchema = extendApi(
  z.object({
    latitude: z.coerce
      .number()
      .min(-90)
      .max(90, { message: 'Latitude must be between -90 and 90.' })
      .describe('Latitude to reverse geocode'),
    longitude: z.coerce
      .number()
      .min(-180)
      .max(180, { message: 'Longitude must be between -180 and 180.' })
      .describe('Longitude to reverse geocode'),
  }),
  {
    description: 'Query schema for reverse geocoding (coordinates to address)',
    example: {
      latitude: 52.52,
      longitude: 13.405,
    },
  },
);

//Type Exports
export type GeocodingResult = z.infer<typeof GeocodingResultSchema>;
export type ForwardGeocodeQuery = z.infer<typeof ForwardGeocodeQuerySchema>;
export type ReverseGeocodeQuery = z.infer<typeof ReverseGeocodeQuerySchema>;

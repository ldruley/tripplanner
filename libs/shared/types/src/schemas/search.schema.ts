import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import {
  citySchema,
  countrySchema,
  fullAddressSchema,
  latitudeSchema,
  longitudeSchema,
  postalCodeSchema,
  regionSchema,
  streetAddressSchema,
} from './base.schema';

export const PoiSearchResultSchema = extendApi(
  z.object({
    // Core geographic data
    latitude: latitudeSchema.describe('Latitude of the POI location'),
    longitude: longitudeSchema.describe('Longitude of the POI location'),

    // Standardized address components
    name: z.string().describe('The name of the point of interest (POI).'),
    fullAddress: fullAddressSchema.describe('Complete formatted address'),
    streetAddress: streetAddressSchema.describe('Street address component'),
    city: citySchema.describe('City or locality'),
    region: regionSchema.describe('Region, state, or province'),
    country: countrySchema.describe('Country'),
    postalCode: postalCodeSchema.describe('Postal or ZIP code'),

    // Timezone information
    timezone: z.string().nullable().optional().describe('Timezone of the location'),

    // Provider metadata
    provider: z
      .enum(['mapbox', 'google', 'here'])
      .describe('The service that provided this geocoding result.'),
    providerId: z.string().describe('The unique ID for this location from the source provider.'),

    rawResponse: z.any().optional().describe('Raw response from the provider (optional)'),
  }),
  {
    title: 'POI Search Result',
    description: 'A point of interest search result with location and address details',
    example: {
      latitude: 48.8566,
      longitude: 2.3522,
      name: 'Eiffel Tower',
      fullAddress: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France',
      streetAddress: '5 Avenue Anatole France',
      city: 'Paris',
      region: 'Île-de-France',
      country: 'France',
      postalCode: '75007',
      provider: 'mapbox',
      providerId: 'poi.123456',
      rawResponse: {},
    },
  },
);

export type PoiSearchResult = z.infer<typeof PoiSearchResultSchema>;

export const PoiSearchQuerySchema = extendApi(
  z.object({
    search: z
      .string()
      .min(3, { message: 'Search query must be at least 3 characters.' })
      .describe('Search term for finding POIs (minimum 3 characters)'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of results to return, defaults to 10.'),
    proximity: z
      .string()
      .min(5)
      .optional()
      .describe('Optional proximity point in "lat,lon" format to bias results towards.'),
    // implement stricter validation for proximity format
    // poi categories
  }),
  {
    title: 'POI Search Query',
    description: 'Query parameters for point of interest search',
    example: {
      search: 'restaurant',
      limit: 10,
      proximity: '48.8566,2.3522',
    },
  },
);

export type PoiSearchQuery = z.infer<typeof PoiSearchQuerySchema>;
export type SearchMode = 'place' | 'address';

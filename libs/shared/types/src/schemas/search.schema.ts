import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import { citySchema, countrySchema, fullAddressSchema, latitudeSchema, longitudeSchema, postalCodeSchema, regionSchema, streetAddressSchema } from './base.schema';

export const PoiSearchResultSchema = z.object({
  // Core geographic data
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  // Standardized address components
  name: z.string().describe("The name of the point of interest (POI)."),
  fullAddress: fullAddressSchema,
  streetAddress: streetAddressSchema,
  city: citySchema,
  region: regionSchema,
  country: countrySchema,
  postalCode: postalCodeSchema,

  // Provider metadata
  provider: z.enum(['mapbox', 'google', 'here']).describe("The service that provided this geocoding result."),
  providerId: z.string().describe("The unique ID for this location from the source provider."),

  rawResponse: z.any().optional(),
});

export type PoiSearchResult = z.infer<typeof PoiSearchResultSchema>;
export class PoiSearchResultDto extends createZodDto(PoiSearchResultSchema) {}

export const PoiSearchQuerySchema = z.object({
  search: z.string().min(3, { message: 'Search query must be at least 3 characters.' }),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe("Maximum number of results to return, defaults to 10."),
  proximity: z.string().min(5).optional().describe('Optional proximity point in "lat,lon" format to bias results towards.'),
  // implement stricter validation for proximity format
  // poi categories
});

export class PoiSearchQueryDto extends createZodDto(PoiSearchQuerySchema) {}



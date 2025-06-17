import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const GeocodingResultSchema = z.object({
  // Core geographic data
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  // Standardized address components
  fullAddress: z.string().describe("The complete, formatted address from the provider."),
  streetAddress: z.string().nullable().describe("Street number and name, e.g., '1600 Amphitheatre Pkwy'"),
  city: z.string().nullable(),
  region: z.string().nullable().describe("State or Province, e.g., 'CA' or 'California'"),
  country: z.string().nullable(),
  postalCode: z.string().nullable(),

  // Provider metadata
  provider: z.enum(['mapbox', 'google', 'here']).describe("The service that provided this geocoding result."),
  providerId: z.string().describe("The unique ID for this location from the source provider."),

  rawResponse: z.any().optional(),
});

export type GeocodingResult = z.infer<typeof GeocodingResultSchema>;
export class GeocodingResultDto extends createZodDto(GeocodingResultSchema) {}

export const ForwardGeocodeQuerySchema = z.object({
  search: z.string().min(3, { message: 'Search query must be at least 3 characters.' }),
});
export type ForwardGeocodeQueryDto = z.infer<typeof ForwardGeocodeQuerySchema>;

export const ReverseGeocodeQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90.' }),
  longitude: z.coerce.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180.' }),
});
export class ReverseGeocodeQueryDto extends createZodDto(ReverseGeocodeQuerySchema) {};

import { z } from 'zod';
import { citySchema, countrySchema, fullAddressSchema, latitudeSchema, longitudeSchema, postalCodeSchema, regionSchema, streetAddressSchema } from './base.schema';

export const GeocodingResultSchema = z.object({
  // Core geographic data
  latitude: latitudeSchema,
  longitude: longitudeSchema,

  // Standardized address components
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

export type GeocodingResult = z.infer<typeof GeocodingResultSchema>;


export const ForwardGeocodeQuerySchema = z.object({
  search: z.string().min(3, { message: 'Search query must be at least 3 characters.' }),
});
export type ForwardGeocodeQuery = z.infer<typeof ForwardGeocodeQuerySchema>;


export const ReverseGeocodeQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90, { message: 'Latitude must be between -90 and 90.' }),
  longitude: z.coerce.number().min(-180).max(180, { message: 'Longitude must be between -180 and 180.' }),
});
export type ReverseGeocodeQuery = z.infer<typeof ReverseGeocodeQuerySchema>;


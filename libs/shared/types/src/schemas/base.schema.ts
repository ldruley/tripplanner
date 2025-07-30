import { z } from 'zod';
import { DistanceUnit as PrismaDistanceUnit } from '@prisma/client';

// Base schemas for common data types
export const nameSchema = z
  .string()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name cannot exceed 100 characters' })
  .describe('A human-readable name, required and up to 100 characters.');

export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid ID format' })
  .describe('A universally unique identifier (UUID) string.');

export const emailSchema = z
  .string()
  .min(1, { message: 'Email is required' })
  .email({ message: 'Please enter a valid email address' })
  .describe('A valid email address.');

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .describe('A password with at least 8 characters.');

// Base schemas for common location data types
export const latitudeSchema = z.coerce
  .number()
  .min(-90, { message: 'Latitude must be between -90 and 90' })
  .max(90, { message: 'Latitude must be between -90 and 90' })
  .describe('Latitude in decimal degrees, between -90 and 90.');

export const longitudeSchema = z.coerce
  .number()
  .min(-180, { message: 'Longitude must be between -180 and 180' })
  .max(180, { message: 'Longitude must be between -180 and 180' })
  .describe('Longitude in decimal degrees, between -180 and 180.');

export const coordinateSchema = z
  .object({
    lat: latitudeSchema.describe('Latitude of the coordinate.'),
    lng: longitudeSchema.describe('Longitude of the coordinate.'),
  })
  .describe('A geographic coordinate with latitude and longitude.');

export type Coordinate = z.infer<typeof coordinateSchema>;

export const coordinatesArraySchema = z
  .array(coordinateSchema)
  .describe('An array of geographic coordinates.');

export const fullAddressSchema = z
  .string()
  .describe('A full formatted address as a single string.');

export const streetAddressSchema = z
  .string()
  .nullable()
  .describe('Street address component, nullable if not available.');

export const citySchema = z
  .string()
  .nullable()
  .describe('City or locality, nullable if not available.');

export const regionSchema = z
  .string()
  .nullable()
  .describe('Region, state, or province, nullable if not available.');

export const countrySchema = z.string().nullable().describe('Country, nullable if not available.');

export const postalCodeSchema = z
  .string()
  .nullable()
  .describe('Postal or ZIP code, nullable if not available.');

export const distanceUnitSchema = z
  .nativeEnum(PrismaDistanceUnit)
  .default(PrismaDistanceUnit.MILES)
  .describe('Preferred distance unit (MILES or KILOMETERS)');

export const ErrorResponseSchema = z
  .object({
    success: z
      .literal(false)
      .describe('Indicates if the request was successful; always false for errors.'),
    error: z.string().describe('A code or short description of the error type.'),
    message: z.string().optional().describe('A human-readable message explaining the error.'),
    details: z
      .record(z.unknown())
      .optional()
      .describe('Optional detailed information about the error, such as validation errors.'),
    timestamp: z.string().datetime().describe('The ISO 8601 timestamp of when the error occurred.'),
    path: z.string().describe('The request path that caused the error.'),
    statusCode: z.number().int().describe('The HTTP status code of the response.'),
  })
  .describe('Standard error response schema for API errors.');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Common provider schemas
export const ApiProviderSchema = z
  .enum(['HERE', 'MAPBOX', 'GOOGLE'])
  .describe('API provider type.');
export const GeoProviderSchema = z
  .enum(['mapbox', 'google', 'here'])
  .describe('Geocoding provider type.');

// Common response wrapper schemas
export const createSuccessResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean().default(true).describe('Indicates if the request was successful.'),
    data: dataSchema,
    message: z.string().optional().describe('Optional success message.'),
  });

export const createPaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    success: z.boolean().default(true).describe('Indicates if the request was successful.'),
    data: z.object({
      items: z.array(itemSchema).describe('Array of items for the current page.'),
      total: z.number().int().min(0).describe('Total number of items across all pages.'),
      page: z.number().int().min(1).describe('Current page number (1-based).'),
      limit: z.number().int().min(1).max(100).describe('Number of items per page.'),
      totalPages: z.number().int().min(0).describe('Total number of pages.'),
    }),
    message: z.string().optional().describe('Optional success message.'),
  });

// Custom pagination helper for different field names (e.g., 'profiles' instead of 'items')
export const createCustomPaginatedResponseSchema = <T extends z.ZodType>(
  itemSchema: T,
  itemsFieldName: string,
) =>
  z.object({
    success: z.boolean().default(true).describe('Indicates if the request was successful.'),
    data: z.object({
      [itemsFieldName]: z
        .array(itemSchema)
        .describe(`Array of ${itemsFieldName} for the current page.`),
      total: z.number().int().min(0).describe('Total number of items across all pages.'),
      page: z.number().int().min(1).describe('Current page number (1-based).'),
      limit: z.number().int().min(1).max(100).describe('Number of items per page.'),
      totalPages: z.number().int().min(0).describe('Total number of pages.'),
    }),
    message: z.string().optional().describe('Optional success message.'),
  });

// Common entity patterns
export const createEntitySchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object({
    ...shape,
    createdAt: z.coerce.date().describe('Timestamp when the entity was created.'),
    updatedAt: z.coerce.date().describe('Timestamp when the entity was last updated.'),
  });

// Helper for creating request schemas (omitting auto-generated fields)
export const createRequestSchema = <T extends z.ZodObject<any>>(
  baseSchema: T,
  omitFields: (keyof z.infer<T>)[],
) => {
  const omitObject = Object.fromEntries(omitFields.map(field => [field, true])) as Record<
    string,
    true
  >;
  return baseSchema.omit(omitObject);
};

// Common field groups
export const addressComponentSchema = z
  .object({
    address: streetAddressSchema,
    city: citySchema,
    state: regionSchema,
    country: countrySchema,
    postalCode: postalCodeSchema,
  })
  .describe('Address component fields.');

export const coordinateGroupSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .describe('Geographic coordinate fields.');

// Base location result schema (for use across geocoding, search, etc.)
export const BaseLocationResultSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    name: z.string().describe('Human-readable name of the location.'),
    fullAddress: fullAddressSchema,
    streetAddress: streetAddressSchema,
    city: citySchema,
    region: regionSchema,
    country: countrySchema,
    postalCode: postalCodeSchema,
    provider: GeoProviderSchema,
    providerId: z.string().describe('Unique identifier from the provider.'),
  })
  .describe('Base schema for location search results across different providers.');

export type BaseLocationResult = z.infer<typeof BaseLocationResultSchema>;
export type DistanceUnit = z.infer<typeof distanceUnitSchema>;

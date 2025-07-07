import { z } from 'zod';

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

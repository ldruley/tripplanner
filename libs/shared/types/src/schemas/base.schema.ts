import { z } from 'zod';

// Base schemas for common data types
export const nameSchema = z
  .string()
  .min(1, { message: 'Name is required' })
  .max(100, { message: 'Name cannot exceed 100 characters' });

export const uuidSchema = z.string().uuid({ message: 'Invalid ID format' });

export const emailSchema = z
  .string()
  .min(1, { message: 'Email is required' })
  .email({ message: 'Please enter a valid email address' });

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' });

// Base schemas for common location data types
export const latitudeSchema = z.coerce
  .number()
  .min(-90, { message: 'Latitude must be between -90 and 90' })
  .max(90, { message: 'Latitude must be between -90 and 90' });

export const longitudeSchema = z.coerce
  .number()
  .min(-180, { message: 'Longitude must be between -180 and 180' })
  .max(180, { message: 'Longitude must be between -180 and 180' });

export const coordinateSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export type Coordinate = z.infer<typeof coordinateSchema>;

export const coordinatesArraySchema = z.array(coordinateSchema);

export const fullAddressSchema = z.string();

export const streetAddressSchema = z.string().nullable();

export const citySchema = z.string().nullable();

export const regionSchema = z.string().nullable();

export const countrySchema = z.string().nullable();

export const postalCodeSchema = z.string().nullable();

export const ErrorResponseSchema = z.object({
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
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

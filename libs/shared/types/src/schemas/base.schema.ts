import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

// Base schemas for common data types
export const nameSchema = extendApi(
  z.string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name cannot exceed 100 characters' }),
  {
    title: 'Name',
    description: 'A name between 1 and 100 characters',
    example: 'John',
  }
);

export const uuidSchema = extendApi(
  z.string()
    .uuid({ message: 'Invalid ID format' }),
  {
    title: 'UUID',
    description: 'A valid UUID v4 string',
    example: '123e4567-e89b-12d3-a456-426614174000',
  }
);

export const emailSchema = extendApi(
  z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  {
    title: 'Email Address',
    description: 'A valid email address',
    example: 'john.doe@example.com',
  }
);

export const passwordSchema = extendApi(
  z.string()
    .min(8, { message: 'Password must be at least 8 characters long' }),
  {
    title: 'Password',
    description: 'A password with a minimum length of 8 characters',
    example: 'P@ssw0rd123',
  }
);

// Base schemas for common location data types
export const latitudeSchema = extendApi(
  z.number()
    .min(-90, { message: 'Latitude must be between -90 and 90' })
    .max(90, { message: 'Latitude must be between -90 and 90' }),
  {
    title: 'Latitude',
    description: 'A latitude value between -90 and 90',
    example: 37.7749,
  }
);

export const longitudeSchema = extendApi(
  z.number()
    .min(-180, { message: 'Longitude must be between -180 and 180' })
    .max(180, { message: 'Longitude must be between -180 and 180' }),
  {
    title: 'Longitude',
    description: 'A longitude value between -180 and 180',
    example: -122.4194,
  }
);

export const fullAddressSchema = extendApi(
  z.string(),
  {
    title: 'Full Address',
    description: 'A complete address string',
    example: '123 Main St, San Francisco, CA 94105, USA',
  }
);

export const streetAddressSchema = extendApi(
  z.string()
    .nullable(),
  {
    title: 'Street Address',
    description: 'A street address string, which can be null',
    example: '123 Main St',
  }
);

export const citySchema = extendApi(
  z.string()
    .nullable(),
  {
    title: 'City',
    description: 'A city name string, which can be null',
    example: 'San Francisco',
  }
);

export const regionSchema = extendApi(
  z.string()
    .nullable(),
  {
    title: 'Region',
    description: 'A region name string, which can be null',
    example: 'California',
  }
);

export const countrySchema = extendApi(
  z.string()
    .nullable(),
  {
    title: 'Country',
    description: 'A country name string, which can be null',
    example: 'United States',
  }
);

export const postalCodeSchema = extendApi(
  z.string()
    .nullable(),
  {
    title: 'Postal Code',
    description: 'A postal code string, which can be null',
    example: '94105',
  }
);

export const ErrorResponseSchema = extendApi(z.object({
  success: z.literal(false).describe('Indicates if the request was successful; always false for errors.'),
  error: z.string().describe('A code or short description of the error type.'),
  message: z.string().optional().describe('A human-readable message explaining the error.'),
  details: z.record(z.any()).optional().describe('Optional detailed information about the error, such as validation errors.'),
  timestamp: z.string().datetime().describe('The ISO 8601 timestamp of when the error occurred.'),
  path: z.string().describe('The request path that caused the error.'),
  statusCode: z.number().int().describe('The HTTP status code of the response.'),
}),  {
  title: 'Error Response',
  description: 'API error response format',
});

// Pagination schemas
export const pageSchema = z.coerce.number()
  .int({ message: 'Page must be a whole number' })
  .min(1, { message: 'Page must be at least 1' })
  .default(1);

export const limitSchema = z.coerce.number()
  .int({ message: 'Limit must be a whole number' })
  .min(1, { message: 'Limit must be at least 1' })
  .max(100, { message: 'Limit cannot exceed 100' })
  .default(10);

export const searchSchema = z.string()
  .min(1, { message: 'Search term cannot be empty' })
  .max(200, { message: 'Search term cannot exceed 200 characters' })
  .optional();

export const sortOrderSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Sort order must be either "asc" or "desc"' })
}).default('desc');

// Generic ID schema
export const idSchema = z.string()
  .min(1, { message: 'ID is required' });

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

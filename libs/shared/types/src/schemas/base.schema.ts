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

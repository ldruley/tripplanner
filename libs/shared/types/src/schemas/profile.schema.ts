import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';
import { UserStatus, UserRole } from '@prisma/client';

// Reusable primitives
const uuidSchema = extendApi(z.string().uuid(), {
  title: 'UUID',
  description: 'A valid UUID v4 string',
  example: '123e4567-e89b-12d3-a456-426614174000',
});

const emailSchema = extendApi(z.string().email().min(1), {
  title: 'Email Address',
  description: 'A valid email address',
  example: 'john.doe@example.com',
});

const nameSchema = extendApi(z.string().min(1).max(100), {
  title: 'Name',
  description: 'A name between 1 and 100 characters',
  example: 'John',
});

const displayNameSchema = extendApi(z.string().max(200), {
  title: 'Display Name',
  description: 'A display name up to 200 characters',
  example: 'John Doe',
});

const avatarUrlSchema = extendApi(z.string().url(), {
  title: 'Avatar URL',
  description: 'A valid URL pointing to an avatar image',
  example: 'https://example.com/avatars/john-doe.jpg',
});

const roleSchema = extendApi(z.nativeEnum(UserRole), {
  title: 'User Role',
  description: 'The role assigned to the user',
  example: 'user',
});

const statusSchema = extendApi(z.nativeEnum(UserStatus), {
  title: 'User Status',
  description: 'The current status of the user account',
  example: 'active',
});

// Main schema
export const ProfileSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  first_name: nameSchema.nullable(),
  last_name: nameSchema.nullable(),
  display_name: displayNameSchema.nullable(),
  avatar_url: avatarUrlSchema.nullable(),
  role: roleSchema,
  status: statusSchema,
  last_sign_in_at: z.coerce.date().nullable(),
  created_at: z.coerce.date().nullable(),
  updated_at: z.coerce.date().nullable(),
  onboarding_completed: z.boolean().nullable(),
});

// Create
export const CreateProfileSchema = z.object({
  email: emailSchema,
  first_name: nameSchema.nullable().optional(),
  last_name: nameSchema.nullable().optional(),
  display_name: displayNameSchema.nullable().optional(),
  avatar_url: avatarUrlSchema.nullable().optional(),
  role: roleSchema,
  status: statusSchema,
  last_sign_in_at: z.coerce.date().nullable().optional(),
  onboarding_completed: z.boolean().nullable().optional(),
});

// Update
export const UpdateProfileSchema = extendApi(ProfileSchema.partial().omit({
  id: true,
  email: true,
  created_at: true,
  updated_at: true,
  last_sign_in_at: true,
}), {
  title: 'Update Profile',
  description: 'Data that can be updated in a user profile',
});

// API Response
export const ProfileResponseSchema = extendApi(z.object({
  success: z.boolean().default(true),
  data: ProfileSchema,
  message: z.string().optional(),
}), {
  title: 'Profile Response',
  description: 'API response containing profile data',
});

export const ProfilesListResponseSchema = extendApi(z.object({
  success: z.boolean().default(true),
  data: z.object({
    profiles: z.array(ProfileSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total_pages: z.number().int().min(0),
  }),
  message: z.string().optional(),
}), {
  title: 'Profiles List Response',
  description: 'API response containing paginated list of profiles',
});

// Query Parameters
export const ProfileQuerySchema = extendApi(z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
}), {
  title: 'Profile Query Parameters',
  description: 'Query parameters for filtering and paginating profiles',
});

// Error Response
export const ErrorResponseSchema = extendApi(z.object({
  success: z.boolean().default(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.record(z.any()).optional(),
}), {
  title: 'Error Response',
  description: 'API error response format',
});

// 🧾 Type Exports
export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type ProfilesListResponse = z.infer<typeof ProfilesListResponseSchema>;
export type ProfileQuery = z.infer<typeof ProfileQuerySchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

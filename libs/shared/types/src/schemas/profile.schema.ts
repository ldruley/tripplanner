import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';

const uuidSchema = extendApi(z.string().uuid(), {
  title: 'UUID',
  description: 'A valid UUID v4 string',
  example: '123e4567-e89b-12d3-a456-426614174000'
});

const emailSchema = extendApi(z.string().email().min(1), {
  title: 'Email Address',
  description: 'A valid email address',
  example: 'john.doe@example.com'
});

const nameSchema = extendApi(z.string().min(1).max(100), {
  title: 'Name',
  description: 'A name between 1 and 100 characters',
  example: 'John'
});

const displayNameSchema = extendApi(z.string().max(200), {
  title: 'Display Name',
  description: 'A display name up to 200 characters',
  example: 'John Doe'
});

const avatarUrlSchema = extendApi(z.string().url(), {
  title: 'Avatar URL',
  description: 'A valid URL pointing to an avatar image',
  example: 'https://example.com/avatars/john-doe.jpg'
});

const roleSchema = extendApi(z.enum(['user', 'admin', 'moderator']), {
  title: 'User Role',
  description: 'The role assigned to the user',
  example: 'user'
});

const statusSchema = extendApi(z.enum(['active', 'suspended', 'pending']), {
  title: 'User Status',
  description: 'The current status of the user account',
  example: 'active'
});

const metadataSchema = extendApi(z.record(z.any()), {
  title: 'Metadata',
  description: 'Additional metadata stored as key-value pairs',
  example: { theme: 'dark', language: 'en', notifications: true }
});

const timestampSchema = extendApi(z.string().datetime(), {
  title: 'Timestamp',
  description: 'ISO 8601 datetime string',
  example: '2024-01-15T10:30:00.000Z'
});

// Profile schema
const profileSchema = extendApi(z.object({
  id: uuidSchema,
  email: emailSchema,
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  display_name: displayNameSchema.optional(),
  avatar_url: avatarUrlSchema.optional(),
  role: roleSchema.default('user').optional(),
  status: statusSchema.default('active').optional(),
  metadata: metadataSchema.default({}).optional(),
  last_sign_in_at: timestampSchema.optional(),
  created_at: timestampSchema.optional(),
  updated_at: timestampSchema.optional(),
}), {
  title: 'Profile',
  description: 'User profile information'
});

// Create profile schema (for new profiles)
const createProfileSchema = extendApi(profileSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  last_sign_in_at: true,
}), {
  title: 'Create Profile',
  description: 'Data required to create a new user profile'
});

// Update profile schema (for updating existing profiles)
const updateProfileSchema = extendApi(profileSchema.partial().omit({
  id: true,
  email: true, // Email shouldn't be updated through this endpoint
  created_at: true,
  updated_at: true,
  last_sign_in_at: true,
}), {
  title: 'Update Profile',
  description: 'Data that can be updated in a user profile'
});

// Profile response schema (what gets returned from API)
const profileResponseSchema = extendApi(z.object({
  success: z.boolean().default(true),
  data: profileSchema,
  message: z.string().optional(),
}), {
  title: 'Profile Response',
  description: 'API response containing profile data'
});

// Profiles list response schema
const profilesListResponseSchema = extendApi(z.object({
  success: z.boolean().default(true),
  data: z.object({
    profiles: z.array(profileSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total_pages: z.number().int().min(0),
  }),
  message: z.string().optional(),
}), {
  title: 'Profiles List Response',
  description: 'API response containing paginated list of profiles'
});

// Query parameters schema
const profileQuerySchema = extendApi(z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
}), {
  title: 'Profile Query Parameters',
  description: 'Query parameters for filtering and paginating profiles'
});

// Error response schema
const errorResponseSchema = extendApi(z.object({
  success: z.boolean().default(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.record(z.any()).optional(),
}), {
  title: 'Error Response',
  description: 'API error response format'
});

export {
  profileSchema,
  createProfileSchema,
  updateProfileSchema,
  profileResponseSchema,
  profilesListResponseSchema,
  profileQuerySchema,
  errorResponseSchema,
};

export type Profile = z.infer<typeof profileSchema>;
export type CreateProfile = z.infer<typeof createProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
export type ProfilesListResponse = z.infer<typeof profilesListResponseSchema>;
export type ProfileQuery = z.infer<typeof profileQuerySchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

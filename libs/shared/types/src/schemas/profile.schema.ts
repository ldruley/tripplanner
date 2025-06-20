import { extendApi } from '@anatine/zod-openapi';
import { z } from 'zod';
import { UserStatus, UserRole } from '@trip-planner/prisma';
import { nameSchema, uuidSchema } from './base.schema';

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

const statusSchema = extendApi(z.nativeEnum(UserStatus), {
  title: 'User Status',
  description: 'The current status of the user account',
  example: 'active',
});

// Main schema
export const ProfileSchema = z.object({
  id: uuidSchema,
  firstName: nameSchema.nullable(),
  lastName: nameSchema.nullable(),
  displayName: displayNameSchema.nullable(),
  avatarUrl: avatarUrlSchema.nullable(),
  status: statusSchema,
  lastSignInAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date().nullable(),
  onboardingCompleted: z.boolean().nullable(),
});

// Create
export const CreateProfileSchema = z.object({
  firstName: nameSchema.nullable().optional(),
  lastName: nameSchema.nullable().optional(),
  displayName: displayNameSchema.nullable().optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
  status: statusSchema,
  lastSignInAt: z.coerce.date().nullable().optional(),
  onboardingCompleted: z.boolean().nullable().optional(),
});

// Update
export const UpdateProfileSchema = extendApi(ProfileSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSignInAt: true,
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
    totalPages: z.number().int().min(0),
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
  status: statusSchema.optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
}), {
  title: 'Profile Query Parameters',
  description: 'Query parameters for filtering and paginating profiles',
});

// Type Exports
export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type ProfilesListResponse = z.infer<typeof ProfilesListResponseSchema>;
export type ProfileQuery = z.infer<typeof ProfileQuerySchema>;

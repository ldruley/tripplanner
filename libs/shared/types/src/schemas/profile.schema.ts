import { z } from 'zod';
import { nameSchema, uuidSchema } from './base.schema';
import { UserStatus } from '@prisma/client';


const displayNameSchema = z.string().max(200);

const avatarUrlSchema = z.string().url();

const statusSchema = z.nativeEnum(UserStatus);

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
export const UpdateProfileSchema = ProfileSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSignInAt: true,
});

// API Response
export const ProfileResponseSchema = z.object({
  success: z.boolean().default(true),
  data: ProfileSchema,
  message: z.string().optional(),
});

export const ProfilesListResponseSchema = z.object({
  success: z.boolean().default(true),
  data: z.object({
    profiles: z.array(ProfileSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    totalPages: z.number().int().min(0),
  }),
  message: z.string().optional(),
});

// Query Parameters
export const ProfileQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: statusSchema.optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Type Exports
export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type ProfilesListResponse = z.infer<typeof ProfilesListResponseSchema>;
export type ProfileQuery = z.infer<typeof ProfileQuerySchema>;

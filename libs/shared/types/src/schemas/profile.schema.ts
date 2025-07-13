import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { nameSchema, uuidSchema, createSuccessResponseSchema } from './base.schema';
import { UserStatus } from '@prisma/client';

const displayNameSchema = z.string().max(200).describe('Display name for the user profile (max 200 characters)');

const avatarUrlSchema = z.string().url().describe('URL to the user avatar image');

const statusSchema = z.nativeEnum(UserStatus).describe('User account status');

// Main schema
export const ProfileSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the profile'),
    firstName: nameSchema.nullable().describe('User first name'),
    lastName: nameSchema.nullable().describe('User last name'),
    displayName: displayNameSchema.nullable(),
    avatarUrl: avatarUrlSchema.nullable(),
    status: statusSchema,
    lastSignInAt: z.coerce.date().nullable().describe('Timestamp of last sign in'),
    createdAt: z.coerce.date().nullable().describe('Timestamp when profile was created'),
    updatedAt: z.coerce.date().nullable().describe('Timestamp when profile was last updated'),
    onboardingCompleted: z.boolean().nullable().describe('Whether user has completed onboarding'),
  }),
  {
    title: 'Profile',
    description: 'User profile information',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
      status: 'ACTIVE',
      lastSignInAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      onboardingCompleted: true,
    },
  },
);

// Create
export const CreateProfileSchema = extendApi(
  z.object({
    firstName: nameSchema.nullable().optional().describe('User first name'),
    lastName: nameSchema.nullable().optional().describe('User last name'),
    displayName: displayNameSchema.nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    status: statusSchema,
    lastSignInAt: z.coerce.date().nullable().optional().describe('Timestamp of last sign in'),
    onboardingCompleted: z.boolean().nullable().optional().describe('Whether user has completed onboarding'),
  }),
  {
    title: 'Create Profile',
    description: 'Schema for creating a new user profile',
    example: {
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/avatar.jpg',
      status: 'ACTIVE',
      onboardingCompleted: false,
    },
  },
);

// Update
export const UpdateProfileSchema = extendApi(
  ProfileSchema.partial().omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastSignInAt: true,
  }),
  {
    title: 'Update Profile',
    description: 'Schema for updating user profile (all fields optional)',
    example: {
      firstName: 'Jane',
      displayName: 'Jane Doe',
      avatarUrl: 'https://example.com/new-avatar.jpg',
    },
  },
);

// API Response
export const ProfileResponseSchema = extendApi(
  createSuccessResponseSchema(ProfileSchema),
  {
    title: 'Profile Response',
    description: 'Standard response schema for profile operations',
    example: {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        status: 'ACTIVE',
        lastSignInAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        onboardingCompleted: true,
      },
      message: 'Profile retrieved successfully',
    },
  },
);

export const ProfilesListResponseSchema = extendApi(
  z.object({
    success: z.boolean().default(true).describe('Indicates if the operation was successful'),
    data: z.object({
      profiles: z.array(ProfileSchema).describe('Array of profile objects'),
      total: z.number().int().min(0).describe('Total number of profiles'),
      page: z.number().int().min(1).describe('Current page number'),
      limit: z.number().int().min(1).max(100).describe('Number of items per page'),
      totalPages: z.number().int().min(0).describe('Total number of pages'),
    }).describe('Paginated profiles data'),
    message: z.string().optional().describe('Optional message about the operation'),
  }),
  {
    title: 'Profiles List Response',
    description: 'Paginated response schema for profile listings',
    example: {
      success: true,
      data: {
        profiles: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            firstName: 'John',
            lastName: 'Doe',
            displayName: 'John Doe',
            avatarUrl: 'https://example.com/avatar.jpg',
            status: 'ACTIVE',
            lastSignInAt: '2024-01-01T00:00:00Z',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            onboardingCompleted: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
      message: 'Profiles retrieved successfully',
    },
  },
);

// Query Parameters
export const ProfileQuerySchema = extendApi(
  z.object({
    page: z.coerce.number().int().min(1).default(1).describe('Page number for pagination'),
    limit: z.coerce.number().int().min(1).max(100).default(10).describe('Number of items per page (max 100)'),
    search: z.string().optional().describe('Search term to filter profiles'),
    status: statusSchema.optional().describe('Filter by user status'),
    sortBy: z
      .enum(['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name'])
      .default('created_at')
      .describe('Field to sort by'),
    sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order'),
  }),
  {
    title: 'Profile Query',
    description: 'Query parameters for profile search and pagination',
    example: {
      page: 1,
      limit: 10,
      search: 'john',
      status: 'ACTIVE',
      sortBy: 'created_at',
      sortOrder: 'desc',
    },
  },
);

// Type Exports
export type Profile = z.infer<typeof ProfileSchema>;
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type ProfilesListResponse = z.infer<typeof ProfilesListResponseSchema>;
export type ProfileQuery = z.infer<typeof ProfileQuerySchema>;

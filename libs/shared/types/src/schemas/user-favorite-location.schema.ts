import { z } from 'zod';
import { uuidSchema } from './base.schema';
import { LocationSchema } from './location.schema';
import { extendApi } from '@anatine/zod-openapi';

export const UserFavoriteLocationSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the user favorite location'),
    userId: uuidSchema.describe('ID of the user who favorited the location'),
    locationId: uuidSchema.describe('ID of the favorited location'),
    alias: z
      .string()
      .nullable()
      .optional()
      .describe('Custom alias/name for the location set by the user'),
    tags: z.array(z.string()).default([]).describe('Array of user-defined tags for the location'),
    notes: z.string().nullable().optional().describe('Personal notes about the location'),
    createdAt: z.coerce.date().describe('Timestamp when the location was favorited'),
    location: LocationSchema,
  }),
  {
    title: 'User Favorite Location',
    description: 'Represents a location that a user has added to their favorites',
    example: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      userId: 'b7e23ec29af22b0b4e41da31e868d572',
      locationId: 'a3f5c89e-1234-5678-9abc-def012345678',
      alias: 'My Favorite Coffee Shop',
      tags: ['coffee', 'work', 'breakfast'],
      notes: 'Great wifi and quiet atmosphere. Perfect for morning work sessions.',
      createdAt: '2024-01-01T12:00:00.000Z',
      location: {
        id: 'a3f5c89e-1234-5678-9abc-def012345678',
        name: 'Blue Bottle Coffee',
        description: 'Artisanal coffee shop',
        address: '123 Main Street',
        houseNumber: '123',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        postalCode: '94105',
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: 'America/Los_Angeles',
        apiSource: 'HERE',
        apiSourceId: 'here:pds:place:example',
        extendedData: null,
        category: 'RESTAURANT',
        public: true,
        createdAt: '2024-01-01T12:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
      },
    },
  },
);

export const CreateUserFavoriteLocationSchema = UserFavoriteLocationSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  location: true,
});

export const UpdateUserFavoriteLocationSchema = UserFavoriteLocationSchema.omit({
  id: true,
  userId: true,
  locationId: true,
  createdAt: true,
}).partial();

export type UserFavoriteLocation = z.infer<typeof UserFavoriteLocationSchema>;
export type CreateUserFavoriteLocation = z.infer<typeof CreateUserFavoriteLocationSchema>;
export type UpdateUserFavoriteLocation = z.infer<typeof UpdateUserFavoriteLocationSchema>;

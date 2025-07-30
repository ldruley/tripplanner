import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { DistanceUnit } from '@prisma/client';
import { getTimeZones } from '@vvo/tzdb';
import { distanceUnitSchema } from './base.schema';

const validTimezones = getTimeZones().map(tz => tz.name);

const timezoneSchema = z
  .string()
  .refine(
    value => {
      return validTimezones.includes(value);
    },
    {
      message: 'Invalid timezone. Must be a valid IANA timezone identifier.',
    },
  )
  .describe('Valid IANA timezone identifier (e.g., "Europe/London")');

export const UserSettingsSchema = extendApi(
  z.object({
    id: z.string().uuid().describe('Unique identifier for the user settings'),
    userId: z.string().uuid().describe('ID of the user these settings belong to'),
    timezone: timezoneSchema.default('Europe/London'),
    distanceUnit: distanceUnitSchema,
    darkMode: z.boolean().default(false).describe('Whether dark mode is enabled'),
    createdAt: z.date().optional().describe('Timestamp when settings were created'),
    updatedAt: z.date().optional().describe('Timestamp when settings were last updated'),
  }),
  {
    title: 'User Settings',
    description: 'User preferences and configuration settings',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      timezone: 'Europe/London',
      distanceUnit: 'MILES',
      darkMode: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const CreateUserSettingsSchema = extendApi(
  UserSettingsSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }),
  {
    title: 'Create User Settings',
    description: 'Schema for creating new user settings',
    example: {
      userId: '550e8400-e29b-41d4-a716-446655440001',
      timezone: 'America/New_York',
      distanceUnit: 'KILOMETERS',
      darkMode: true,
    },
  },
);

export const UpdateUserSettingsSchema = extendApi(
  CreateUserSettingsSchema.omit({ userId: true }).partial(),
  {
    title: 'Update User Settings',
    description: 'Schema for updating user settings (all fields optional)',
    example: {
      timezone: 'America/New_York',
      darkMode: true,
    },
  },
);
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type CreateUserSettings = z.infer<typeof CreateUserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;

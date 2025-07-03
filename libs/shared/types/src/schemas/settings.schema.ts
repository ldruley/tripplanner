import { z } from 'zod';
import { DistanceUnit } from '@prisma/client';
import { getTimeZones } from '@vvo/tzdb';

const validTimezones = getTimeZones().map(tz => tz.name);

const timezoneSchema = z.string().refine(
  value => {
    return validTimezones.includes(value);
  },
  {
    message: 'Invalid timezone. Must be a valid IANA timezone identifier.',
  },
);

export const UserSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  timezone: timezoneSchema.default('Europe/London'),
  distanceUnit: z.nativeEnum(DistanceUnit).default(DistanceUnit.MILES),
  darkMode: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const CreateUserSettingsSchema = UserSettingsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateUserSettingsSchema = CreateUserSettingsSchema.omit({ userId: true }).partial();
export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type CreateUserSettings = z.infer<typeof CreateUserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;

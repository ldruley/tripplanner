import { z } from 'zod';
import { DistanceUnit } from '@prisma/client';


export const UserSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  timezone: z.string().default('UTC'),
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

export const UpdateUserSettingsSchema = CreateUserSettingsSchema.partial();

export type UserSettings = z.infer<typeof UserSettingsSchema>;
export type CreateUserSettings = z.infer<typeof CreateUserSettingsSchema>;
export type UpdateUserSettings = z.infer<typeof UpdateUserSettingsSchema>;

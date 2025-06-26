import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { DistanceUnit } from '@prisma/client';
import { createZodDto } from '@anatine/zod-nestjs';

const BaseDistanceUnitSchema = z.nativeEnum(DistanceUnit);

export const DistanceUnitSchema = extendApi(BaseDistanceUnitSchema.default(DistanceUnit.MILES), {
  title: 'Distance Unit',
  description: 'Preferred unit for measuring distance',
  example: 'MILES',
});

export const UserSettingsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  timezone: z.string().default('UTC'),
  distanceUnit: DistanceUnitSchema,
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

export class CreateUserSettingsDto extends createZodDto(CreateUserSettingsSchema) {}
export class UpdateUserSettingsDto extends createZodDto(UpdateUserSettingsSchema) {}

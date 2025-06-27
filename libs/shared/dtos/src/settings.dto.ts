import { createZodDto } from '@anatine/zod-nestjs';
import { CreateUserSettingsSchema, UpdateUserSettingsSchema } from '../../types/src/schemas/settings.schema';

export class CreateUserSettingsDto extends createZodDto(CreateUserSettingsSchema) {}
export class UpdateUserSettingsDto extends createZodDto(UpdateUserSettingsSchema) {}

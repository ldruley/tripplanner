import { createZodDto } from '@anatine/zod-nestjs';
import {
  createProfileSchema, errorResponseSchema, profileQuerySchema,
  profileResponseSchema,
  profileSchema, profilesListResponseSchema,
  updateProfileSchema
} from '../schemas/profile.schema';

export class ProfileDto extends createZodDto(profileSchema) {}

export class CreateProfileDto extends createZodDto(createProfileSchema) {}

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}

export class ProfileResponseDto extends createZodDto(profileResponseSchema) {}

export class ProfilesListResponseDto extends createZodDto(profilesListResponseSchema) {}

export class ProfileQueryDto extends createZodDto(profileQuerySchema) {}

export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}

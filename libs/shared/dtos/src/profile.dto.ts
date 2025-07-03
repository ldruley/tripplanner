import { createZodDto } from '@anatine/zod-nestjs';
import {
  CreateProfileSchema,
  ProfileQuerySchema,
  ProfileResponseSchema,
  ProfileSchema,
  ProfilesListResponseSchema,
  UpdateProfileSchema,
} from '../../types/src/schemas/profile.schema';

import { ErrorResponseSchema } from '../../types/src/schemas/base.schema';

export class ProfileDto extends createZodDto(ProfileSchema) {}

export class CreateProfileDto extends createZodDto(CreateProfileSchema) {}

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export class ProfileResponseDto extends createZodDto(ProfileResponseSchema) {}

export class ProfilesListResponseDto extends createZodDto(ProfilesListResponseSchema) {}

export class ProfileQueryDto extends createZodDto(ProfileQuerySchema) {}

export class ErrorResponseDto extends createZodDto(ErrorResponseSchema) {}

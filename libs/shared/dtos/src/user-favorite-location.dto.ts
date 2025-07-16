import { createZodDto } from '@anatine/zod-nestjs';

import {
  UserFavoriteLocationSchema,
  CreateUserFavoriteLocationSchema,
  UpdateUserFavoriteLocationSchema,
} from '@trip-planner/types';

export class UserFavoriteLocationDto extends createZodDto(UserFavoriteLocationSchema) {}

export class CreateUserFavoriteLocationDto extends createZodDto(CreateUserFavoriteLocationSchema) {}

export class UpdateUserFavoriteLocationDto extends createZodDto(UpdateUserFavoriteLocationSchema) {}

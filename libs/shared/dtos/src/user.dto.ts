import { createZodDto } from '@anatine/zod-nestjs';

import {
  CreateUserSchema,
  LoginUserSchema,
  ChangePasswordSchema,
  UserResponseSchema,
  UserSchema
} from '../../types/src/schemas/user.schema';

export class UserDto extends createZodDto(UserSchema) {}
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class LoginUserDto extends createZodDto(LoginUserSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}

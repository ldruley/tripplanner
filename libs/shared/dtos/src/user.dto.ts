import { createZodDto } from '@anatine/zod-nestjs';

import {
  CreateUserSchema,
  LoginUserSchema,
  ChangePasswordSchema,
  UserResponseSchema,
  UserSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
} from '@trip-planner/types';

export class UserDto extends createZodDto(UserSchema) {}
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class LoginUserDto extends createZodDto(LoginUserSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
export class UserResponseDto extends createZodDto(UserResponseSchema) {}
export class RequestPasswordResetDto extends createZodDto(RequestPasswordResetSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
export class ResendVerificationDto extends createZodDto(ResendVerificationSchema) {}

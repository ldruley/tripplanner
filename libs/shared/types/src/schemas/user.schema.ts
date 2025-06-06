import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { UserRole } from '@prisma/client';
import { nameSchema } from './profile.schema';

const roleSchema = extendApi(z.nativeEnum(UserRole), {
  title: 'User Role',
  description: 'The current role of the user account',
  example: 'user',
});

const emailSchema = extendApi(z.string().email().min(1), {
  title: 'Email Address',
  description: 'A valid email address',
  example: 'john.doe@example.com',
});

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: emailSchema,
  password: z.string(),
  role: roleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SafeUserSchema = UserSchema.omit({ password: true });

export const CreateUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  firstName: nameSchema,
  lastName: nameSchema,
});

export const LoginUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, { message: 'New password must be at least 8 characters long' }),
});

export const UserResponseSchema = z.object({
  success: z.boolean().default(true),
  data: UserSchema.omit({ password: true }),
  message: z.string().optional(),
});

export type SafeUser = z.infer<typeof SafeUserSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type LoginUser = z.infer<typeof LoginUserSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

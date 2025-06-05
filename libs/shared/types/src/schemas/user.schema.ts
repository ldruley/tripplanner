import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { UserRole } from '@prisma/client';

const roleSchema = extendApi(z.nativeEnum(UserRole), {
  title: 'User Role',
  description: 'The current role of the user account',
  example: 'user',
});

export const UserSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  password: z.string(),
  role: roleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SafeUserSchema = UserSchema.omit({ password: true });

export const CreateUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  // roles: z.array(z.string()).optional(),
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

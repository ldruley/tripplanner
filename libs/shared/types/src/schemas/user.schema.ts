import { z } from 'zod';
import { nameSchema, emailSchema, uuidSchema, passwordSchema } from './base.schema';
import { UserRole } from '@prisma/client';


const roleSchema = z.nativeEnum(UserRole);


export const UserSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const SafeUserSchema = UserSchema.omit({ password: true });

export const CreateUserSchema = UserSchema.pick({
  email: true,
  password: true,
}).extend({
  firstName: nameSchema,
  lastName: nameSchema,
});

export const LoginUserSchema = UserSchema.pick({
  email: true,
  password: true ,
});

export const ChangePasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
  confirmPassword: passwordSchema,
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

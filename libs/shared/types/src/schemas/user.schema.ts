import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { nameSchema, emailSchema, uuidSchema, passwordSchema } from './base.schema';
import { UserRole } from '@prisma/client';

const roleSchema = z.nativeEnum(UserRole).describe('User role in the system');

export const UserSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the user'),
    email: emailSchema.describe('User email address, must be unique'),
    password: passwordSchema.describe('Hashed password for authentication'),
    role: roleSchema,
    emailVerified: z
      .boolean()
      .default(false)
      .describe('Whether the user has verified their email address'),
    verificationToken: z
      .string()
      .nullable()
      .optional()
      .describe('Token used for email verification'),
    verificationTokenExpiry: z
      .date()
      .nullable()
      .optional()
      .describe('Expiration date for verification token'),
    resetToken: z.string().nullable().optional().describe('Token used for password reset'),
    resetTokenExpiry: z.date().nullable().optional().describe('Expiration date for reset token'),
    createdAt: z.date().describe('Timestamp when the user account was created'),
    updatedAt: z.date().describe('Timestamp when the user account was last updated'),
  }),
  {
    title: 'User',
    description: 'Complete user entity with authentication and verification fields',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      password: '$2b$10$...',
      role: 'USER',
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      resetToken: null,
      resetTokenExpiry: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const SafeUserSchema = extendApi(
  UserSchema.omit({
    password: true,
    verificationToken: true,
    verificationTokenExpiry: true,
    resetToken: true,
    resetTokenExpiry: true,
  }),
  {
    title: 'Safe User',
    description: 'User entity without sensitive authentication fields',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      role: 'USER',
      emailVerified: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const CreateUserSchema = extendApi(
  UserSchema.pick({
    email: true,
    password: true,
  }).extend({
    firstName: nameSchema.describe('User first name'),
    lastName: nameSchema.describe('User last name'),
    darkMode: z.boolean().default(false).describe('User preference for dark mode'),
  }),
  {
    title: 'Create User',
    description: 'Schema for creating a new user account',
    example: {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      firstName: 'John',
      lastName: 'Doe',
    },
  },
);

export const LoginUserSchema = extendApi(
  UserSchema.pick({
    email: true,
    password: true,
  }),
  {
    title: 'Login User',
    description: 'Schema for user authentication',
    example: {
      email: 'user@example.com',
      password: 'SecurePassword123!',
    },
  },
);

export const ChangePasswordSchema = extendApi(
  z.object({
    currentPassword: passwordSchema.describe('Current password for verification'),
    newPassword: passwordSchema.describe('New password to set'),
    confirmPassword: passwordSchema.describe('Confirmation of new password'),
  }),
  {
    title: 'Change Password',
    description: 'Schema for changing user password',
    example: {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewSecurePassword456!',
      confirmPassword: 'NewSecurePassword456!',
    },
  },
);

export const RequestPasswordResetSchema = extendApi(
  z.object({
    email: emailSchema.describe('Email address to send password reset instructions'),
  }),
  {
    title: 'Request Password Reset',
    description: 'Schema for requesting a password reset',
    example: {
      email: 'user@example.com',
    },
  },
);

export const ResetPasswordSchema = extendApi(
  z
    .object({
      token: z
        .string()
        .min(1, 'Reset token is required')
        .describe('Password reset token from email'),
      newPassword: passwordSchema.describe('New password to set'),
      confirmPassword: passwordSchema.describe('Confirmation of new password'),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }),
  {
    title: 'Reset Password',
    description: 'Schema for resetting password with token',
    example: {
      token: 'abc123def456',
      newPassword: 'NewSecurePassword123!',
      confirmPassword: 'NewSecurePassword123!',
    },
  },
);

export const VerifyEmailSchema = extendApi(
  z.object({
    token: z
      .string()
      .min(1, 'Verification token is required')
      .describe('Email verification token from email'),
  }),
  {
    title: 'Verify Email',
    description: 'Schema for verifying email address',
    example: {
      token: 'verify123abc456',
    },
  },
);

export const ResendVerificationSchema = extendApi(
  z.object({
    email: emailSchema.describe('Email address to resend verification email'),
  }),
  {
    title: 'Resend Verification',
    description: 'Schema for resending email verification',
    example: {
      email: 'user@example.com',
    },
  },
);

export const UserResponseSchema = extendApi(
  z.object({
    success: z.boolean().default(true).describe('Indicates if the operation was successful'),
    data: UserSchema.omit({ password: true }).describe('User data without sensitive fields'),
    message: z.string().optional().describe('Optional message about the operation'),
  }),
  {
    title: 'User Response',
    description: 'Standard response schema for user operations',
    example: {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        role: 'USER',
        emailVerified: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      message: 'User retrieved successfully',
    },
  },
);

export type SafeUser = z.infer<typeof SafeUserSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type LoginUser = z.infer<typeof LoginUserSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type RequestPasswordReset = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;
export type ResendVerification = z.infer<typeof ResendVerificationSchema>;

export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}

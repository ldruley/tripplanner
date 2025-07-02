import { z } from 'zod';

export const EmailTemplateType = z.enum([
  'welcome',
  'password-reset',
  'email-verification',
  'trip-confirmation',
  'trip-reminder'
]);

export const EmailRequestSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  template: EmailTemplateType,
  variables: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().min(1).max(10).optional().default(5),
  scheduledAt: z.date().optional()
});

export const EmailResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['queued', 'sent', 'failed', 'delivered']),
  message: z.string().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional()
});

export const EmailJobDataSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  priority: z.number().optional(),
  attempt: z.number().optional(),
  maxAttempts: z.number().optional()
});

export const EmailTemplateSchema = z.object({
  type: EmailTemplateType,
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  variables: z.array(z.string()).optional()
});

export const EmailConfigSchema = z.object({
  apiKey: z.string(),
  domain: z.string(),
  baseUrl: z.string().url(),
  from: z.string().email(),
  replyTo: z.string().email().optional(),
  testEmail: z.string().email().optional()
});

// Template variable schemas
export const WelcomeEmailVariablesSchema = z.object({
  firstName: z.string().optional(),
  email: z.string().email().optional()
});

export const PasswordResetEmailVariablesSchema = z.object({
  resetToken: z.string(),
  firstName: z.string().optional()
});

export const EmailVerificationVariablesSchema = z.object({
  verificationToken: z.string(),
  firstName: z.string().optional()
});

// Type exports
export type EmailTemplateType = z.infer<typeof EmailTemplateType>;
export type EmailRequest = z.infer<typeof EmailRequestSchema>;
export type EmailResponse = z.infer<typeof EmailResponseSchema>;
export type EmailJobData = z.infer<typeof EmailJobDataSchema>;
export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

// Template variable types
export type WelcomeEmailVariables = z.infer<typeof WelcomeEmailVariablesSchema>;
export type PasswordResetEmailVariables = z.infer<typeof PasswordResetEmailVariablesSchema>;
export type EmailVerificationVariables = z.infer<typeof EmailVerificationVariablesSchema>;

import { z } from 'zod';

export const ToastSeveritySchema = z.enum(['success', 'info', 'warn', 'error']);

export const ToastPositionSchema = z.enum([
  'top-left',
  'top-center', 
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'center'
]);

export const ToastSchema = z.object({
  id: z.string(),
  severity: ToastSeveritySchema,
  summary: z.string(),
  detail: z.string().optional(),
  life: z.number().positive().optional(), // Duration in milliseconds
  sticky: z.boolean().optional(), // If true, toast won't auto-dismiss
  closable: z.boolean().optional(), // If true, shows close button
  data: z.any().optional(), // Additional data
  key: z.string().optional(), // Group key for organizing toasts
});

export const ToastConfigSchema = z.object({
  position: ToastPositionSchema.optional().default('top-right'),
  autoZIndex: z.boolean().optional().default(true),
  baseZIndex: z.number().optional().default(0),
  life: z.number().positive().optional().default(3000), // Global default duration
  sticky: z.boolean().optional().default(false),
  closable: z.boolean().optional().default(true),
  breakpoints: z.record(z.string()).optional(),
});

export const ShowToastOptionsSchema = z.object({
  severity: ToastSeveritySchema.optional().default('info'),
  summary: z.string(),
  detail: z.string().optional(),
  life: z.number().positive().optional(),
  sticky: z.boolean().optional(),
  closable: z.boolean().optional(),
  data: z.any().optional(),
  key: z.string().optional(),
});

// Export types
export type ToastSeverity = z.infer<typeof ToastSeveritySchema>;
export type ToastPosition = z.infer<typeof ToastPositionSchema>;
export type Toast = z.infer<typeof ToastSchema>;
export type ToastConfig = z.infer<typeof ToastConfigSchema>;
export type ShowToastOptions = z.infer<typeof ShowToastOptionsSchema>;

// Convenience interfaces for better TypeScript support
export interface ToastMessage {
  severity?: ToastSeverity;
  summary: string;
  detail?: string;
  life?: number;
  sticky?: boolean;
  closable?: boolean;
  data?: any;
  key?: string;
}

export interface ToastService {
  show(message: ToastMessage): void;
  showSuccess(summary: string, detail?: string, life?: number): void;
  showInfo(summary: string, detail?: string, life?: number): void;
  showWarn(summary: string, detail?: string, life?: number): void;
  showError(summary: string, detail?: string, life?: number): void;
  clear(key?: string): void;
  clearAll(): void;
}
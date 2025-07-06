import { z } from 'zod';

// Base validation schemas
const positiveIntSchema = z.coerce.number().int().positive();
const nonEmptyStringSchema = z.string().min(1, 'Cannot be empty');
const urlSchema = z.string().url('Must be a valid URL');
const emailSchema = z.string().email('Must be a valid email');

// Environment enum
const NodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

// Core Application Configuration
const CoreConfigSchema = z.object({
  NODE_ENV: NodeEnvSchema,
  PORT: positiveIntSchema.default(3000),
  DATABASE_URL: nonEmptyStringSchema.describe('PostgreSQL connection string'),
});

// Authentication Configuration
const AuthConfigSchema = z.object({
  JWT_SECRET: nonEmptyStringSchema.describe('JWT signing secret'),
  JWT_EXPIRATION: nonEmptyStringSchema.default('3600s').describe('JWT expiration time'),
});

// Redis Configuration
const RedisConfigSchema = z.object({
  REDIS_URL: z.string().optional().describe('Redis connection URL'),
  REDIS_HOST: z.string().default('localhost').describe('Redis host'),
  REDIS_PORT: positiveIntSchema.default(6379).describe('Redis port'),
  REDIS_DB: z.coerce.number().int().min(0).default(0).describe('Redis database number'),
});

// API Keys Configuration
const ApiKeysConfigSchema = z.object({
  HERE_API_KEY: nonEmptyStringSchema.describe('HERE Maps API key'),
  MAPBOX_API_KEY: nonEmptyStringSchema.describe('Mapbox API key'),
  TIMEZONEDB_API_KEY: nonEmptyStringSchema.describe('TimezoneDB API key'),
  MAILGUN_API_KEY: nonEmptyStringSchema.describe('Mailgun API key'),
});

// API URLs Configuration
const ApiUrlsConfigSchema = z.object({
  // Mapbox URLs
  MAPBOX_BASE_URL: urlSchema.default('https://api.mapbox.com').describe('Mapbox base API URL'),
  
  // HERE URLs
  HERE_DISCOVER_URL: urlSchema.default('https://discover.search.hereapi.com/v1/discover').describe('HERE Discover API URL'),
  HERE_GEOCODE_URL: urlSchema.default('https://geocode.search.hereapi.com/v1/geocode').describe('HERE Geocoding API URL'),
  HERE_ROUTING_URL: urlSchema.default('https://router.hereapi.com').describe('HERE Routing API URL'),
  
  // Other service URLs
  TIMEZONEDB_BASE_URL: urlSchema.default('https://api.timezonedb.com/v2.1/').describe('TimezoneDB base URL'),
  MAILGUN_BASE_URL: urlSchema.default('https://api.mailgun.net').describe('Mailgun base URL'),
});

// Email Configuration
const EmailConfigSchema = z.object({
  MAILGUN_DOMAIN: nonEmptyStringSchema.describe('Mailgun domain'),
  MAILGUN_FROM: emailSchema.describe('Default sender email address'),
  MAILGUN_TEST_EMAIL: emailSchema.optional().describe('Test email address for development'),
});

// Supabase Configuration (if used)
const SupabaseConfigSchema = z.object({
  SUPABASE_URL: urlSchema.optional().describe('Supabase project URL'),
  SUPABASE_ANON_KEY: z.string().optional().describe('Supabase anonymous key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key'),
});

// API Quotas Schema (for external yaml file)
const ApiQuotasSchema = z.object({
  quotas: z.object({
    here: z.object({
      geocoding: z.object({
        monthly: positiveIntSchema,
      }),
      routing: z.object({
        monthly: positiveIntSchema,
        endpoints: z.object({
          'time-aware': z.object({
            monthly: positiveIntSchema,
          }),
        }).optional(),
      }),
      search: z.object({
        monthly: positiveIntSchema,
      }),
      matrix: z.object({
        monthly: positiveIntSchema,
      }),
    }),
    mapbox: z.object({
      routing: z.object({
        monthly: positiveIntSchema,
      }),
      geocoding: z.object({
        monthly: positiveIntSchema,
      }),
      search: z.object({
        monthly: positiveIntSchema,
      }),
      matrix: z.object({
        monthly: positiveIntSchema,
      }),
    }),
  }),
});

// Complete environment configuration schema
export const EnvironmentConfigSchema = CoreConfigSchema
  .merge(AuthConfigSchema)
  .merge(RedisConfigSchema)
  .merge(ApiKeysConfigSchema)
  .merge(ApiUrlsConfigSchema)
  .merge(EmailConfigSchema)
  .merge(SupabaseConfigSchema);

// Export individual schemas for typed access
export {
  CoreConfigSchema,
  AuthConfigSchema,
  RedisConfigSchema,
  ApiKeysConfigSchema,
  ApiUrlsConfigSchema,
  EmailConfigSchema,
  SupabaseConfigSchema,
  ApiQuotasSchema,
};

// Export types
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;
export type CoreConfig = z.infer<typeof CoreConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type ApiKeysConfig = z.infer<typeof ApiKeysConfigSchema>;
export type ApiUrlsConfig = z.infer<typeof ApiUrlsConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type SupabaseConfig = z.infer<typeof SupabaseConfigSchema>;
export type ApiQuotasConfig = z.infer<typeof ApiQuotasSchema>;
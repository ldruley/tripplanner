import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import {
  EnvironmentConfig,
  EnvironmentConfigSchema,
  CoreConfig,
  AuthConfig,
  RedisConfig,
  ApiKeysConfig,
  ApiUrlsConfig,
  EmailConfig,
  ApiQuotasConfig,
  ApiQuotasSchema,
} from './config.schema';

@Injectable()
export class ValidationConfigService {
  private readonly logger = new Logger(ValidationConfigService.name);
  private validatedConfig!: EnvironmentConfig;
  private apiQuotas!: ApiQuotasConfig;

  constructor(private readonly configService: ConfigService) {
    this.validateAndCacheConfig();
  }

  /**
   * Validates and caches the entire configuration object at initialization
   */
  private validateAndCacheConfig(): void {
    try {
      this.logger.log('Validating environment configuration...');

      // Gather all environment variables
      const rawConfig = {
        NODE_ENV: this.configService.get('NODE_ENV'),
        PORT: this.configService.get('PORT'),
        DATABASE_URL: this.configService.get('DATABASE_URL'),
        JWT_SECRET: this.configService.get('JWT_SECRET'),
        JWT_EXPIRATION: this.configService.get('JWT_EXPIRATION'),
        REDIS_URL: this.configService.get('REDIS_URL'),
        REDIS_HOST: this.configService.get('REDIS_HOST'),
        REDIS_PORT: this.configService.get('REDIS_PORT'),
        REDIS_DB: this.configService.get('REDIS_DB'),
        HERE_API_KEY: this.configService.get('HERE_API_KEY'),
        MAPBOX_API_KEY: this.configService.get('MAPBOX_API_KEY'),
        TIMEZONEDB_API_KEY: this.configService.get('TIMEZONEDB_API_KEY'),
        MAILGUN_API_KEY: this.configService.get('MAILGUN_API_KEY'),
        MAPBOX_BASE_URL: this.configService.get('MAPBOX_BASE_URL'),
        HERE_DISCOVER_URL: this.configService.get('HERE_DISCOVER_URL'),
        HERE_GEOCODE_URL: this.configService.get('HERE_GEOCODE_URL'),
        HERE_ROUTING_URL: this.configService.get('HERE_ROUTING_URL'),
        TIMEZONEDB_BASE_URL: this.configService.get('TIMEZONEDB_BASE_URL'),
        MAILGUN_BASE_URL: this.configService.get('MAILGUN_BASE_URL'),
        MAILGUN_DOMAIN: this.configService.get('MAILGUN_DOMAIN'),
        MAILGUN_FROM: this.configService.get('MAILGUN_FROM'),
        MAILGUN_TEST_EMAIL: this.configService.get('MAILGUN_TEST_EMAIL'),
        SUPABASE_URL: this.configService.get('SUPABASE_URL'),
        SUPABASE_ANON_KEY: this.configService.get('SUPABASE_ANON_KEY'),
        SUPABASE_SERVICE_ROLE_KEY: this.configService.get('SUPABASE_SERVICE_ROLE_KEY'),
      };

      // Validate environment configuration
      this.validatedConfig = EnvironmentConfigSchema.parse(rawConfig);

      // Load and validate API quotas
      this.loadApiQuotas();

      this.logger.log('✅ Environment configuration validated successfully');
      this.logger.log(`Environment: ${this.validatedConfig.NODE_ENV}`);
      this.logger.log(`Port: ${this.validatedConfig.PORT}`);
    } catch (error) {
      this.logger.error('❌ Configuration validation failed:', error);
      if (error instanceof Error) {
        this.logger.error('Configuration errors:', error.message);
      }
      throw new Error(`Configuration validation failed: ${error}`);
    }
  }

  /**
   * Loads and validates API quotas from external YAML file
   */
  private loadApiQuotas(): void {
    try {
      const quotaFilePath = path.join(process.cwd(), 'config', 'api-quotas.yaml');

      if (!fs.existsSync(quotaFilePath)) {
        this.logger.warn(`API quotas file not found at: ${quotaFilePath}`);
        // Provide default quotas if file doesn't exist
        this.apiQuotas = {
          quotas: {
            here: {
              geocoding: { monthly: 30000 },
              routing: { monthly: 30000, endpoints: { 'time-aware': { monthly: 5000 } } },
              search: { monthly: 5000 },
              matrix: { monthly: 2500 },
            },
            mapbox: {
              routing: { monthly: 100000 },
              geocoding: { monthly: 100000 },
              search: { monthly: 50000 },
              matrix: { monthly: 100000 },
            },
          },
        };
        return;
      }

      const quotaFileContent = fs.readFileSync(quotaFilePath, 'utf8');
      const rawQuotas = parseYaml(quotaFileContent);

      this.apiQuotas = ApiQuotasSchema.parse(rawQuotas);
      this.logger.log('✅ API quotas loaded and validated successfully');
    } catch (error) {
      this.logger.error('❌ Failed to load API quotas:', error);
      throw new Error(`API quotas validation failed: ${error}`);
    }
  }

  // Typed getter methods for different configuration sections

  /**
   * Get core application configuration
   */
  getCore(): CoreConfig {
    return {
      NODE_ENV: this.validatedConfig.NODE_ENV,
      PORT: this.validatedConfig.PORT,
      DATABASE_URL: this.validatedConfig.DATABASE_URL,
    };
  }

  /**
   * Get authentication configuration
   */
  getAuth(): AuthConfig {
    return {
      JWT_SECRET: this.validatedConfig.JWT_SECRET,
      JWT_EXPIRATION: this.validatedConfig.JWT_EXPIRATION,
    };
  }

  /**
   * Get Redis configuration
   */
  getRedis(): RedisConfig {
    return {
      REDIS_URL: this.validatedConfig.REDIS_URL,
      REDIS_HOST: this.validatedConfig.REDIS_HOST,
      REDIS_PORT: this.validatedConfig.REDIS_PORT,
      REDIS_DB: this.validatedConfig.REDIS_DB,
    };
  }

  /**
   * Get API keys configuration
   */
  getApiKeys(): ApiKeysConfig {
    return {
      HERE_API_KEY: this.validatedConfig.HERE_API_KEY,
      MAPBOX_API_KEY: this.validatedConfig.MAPBOX_API_KEY,
      TIMEZONEDB_API_KEY: this.validatedConfig.TIMEZONEDB_API_KEY,
      MAILGUN_API_KEY: this.validatedConfig.MAILGUN_API_KEY,
    };
  }

  /**
   * Get API URLs configuration
   */
  getApiUrls(): ApiUrlsConfig {
    return {
      MAPBOX_BASE_URL: this.validatedConfig.MAPBOX_BASE_URL,
      HERE_DISCOVER_URL: this.validatedConfig.HERE_DISCOVER_URL,
      HERE_GEOCODE_URL: this.validatedConfig.HERE_GEOCODE_URL,
      HERE_ROUTING_URL: this.validatedConfig.HERE_ROUTING_URL,
      TIMEZONEDB_BASE_URL: this.validatedConfig.TIMEZONEDB_BASE_URL,
      MAILGUN_BASE_URL: this.validatedConfig.MAILGUN_BASE_URL,
    };
  }

  /**
   * Get email configuration
   */
  getEmail(): EmailConfig {
    return {
      MAILGUN_DOMAIN: this.validatedConfig.MAILGUN_DOMAIN,
      MAILGUN_FROM: this.validatedConfig.MAILGUN_FROM,
      MAILGUN_TEST_EMAIL: this.validatedConfig.MAILGUN_TEST_EMAIL,
    };
  }

  /**
   * Get API quotas configuration
   */
  getApiQuotas(): ApiQuotasConfig {
    return this.apiQuotas;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.validatedConfig.NODE_ENV === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.validatedConfig.NODE_ENV === 'production';
  }

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    return this.validatedConfig.NODE_ENV === 'test';
  }

  /**
   * Get the complete validated configuration (use sparingly)
   */
  getAll(): EnvironmentConfig {
    return { ...this.validatedConfig };
  }
}

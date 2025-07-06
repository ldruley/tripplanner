import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ValidationConfigService } from './validation-config.service';

@Module({})
export class ConfigValidationModule {
  /**
   * Configures the enhanced configuration module with validation
   * This replaces the standard ConfigModule.forRoot() setup
   */
  static forRoot(): DynamicModule {
    return {
      module: ConfigValidationModule,
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, `.env`],
          cache: true,
          expandVariables: true,
          validate: (config: Record<string, unknown>) => {
            // This validation will be called by NestJS ConfigModule
            // But we'll do the main validation in ValidationConfigService.onModuleInit()
            // to provide better error messages and type safety
            return config;
          },
        }),
      ],
      providers: [ValidationConfigService],
      exports: [ValidationConfigService],
      global: true,
    };
  }
}

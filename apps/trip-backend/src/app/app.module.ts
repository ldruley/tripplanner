import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../../../libs/shared/prisma/src';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilesModule } from '../domain/profile/profiles.module';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        `.env`,
      ],
      cache: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrlFromConfig = configService.get<string>('REDIS_URL');

        if (!redisUrlFromConfig) {
          console.warn(
            'REDIS_URL is not configured in environment. Falling back to default redis://localhost:6379.',
          );
        }
        const redisUrl = redisUrlFromConfig || 'redis://localhost:6379';
        const redisStore = createKeyv(redisUrl);

        return {
          store: redisStore,
          ttl: 60 * 1000,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    PrismaModule,
    ProfilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

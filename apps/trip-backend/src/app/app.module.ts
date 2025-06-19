import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../../../libs/shared/prisma/src';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilesModule } from '../domain/profile/profiles.module';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { GeocodingModule } from '../../../../libs/geocoding/src';
import { PoiModule } from '@trip-planner/poi';
import { MatrixRoutingModule } from '@trip-planner/matrix-routing';
import { RedisModule } from '@trip-planner/redis';

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
    AuthModule,
    PrismaModule,
    ProfilesModule,
    GeocodingModule,
    PoiModule,
    MatrixRoutingModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

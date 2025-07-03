import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@trip-planner/prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProfilesModule } from '../domain/profile/profiles.module';
import { AuthModule } from '../infrastructure/auth/auth.module';
import { PoiModule } from '@trip-planner/poi';
import { MatrixRoutingModule } from '@trip-planner/matrix-routing';
import { RedisModule } from '@trip-planner/redis';
import { UserSettingsModule } from '@trip-planner/user-settings';
import { BullMQModule } from '@trip-planner/bullmq';
import { TimezoneModule } from '@trip-planner/timezone';
import { GeocodingModule } from '@trip-planner/geocoding';
import { EmailModule } from '@trip-planner/email';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, `.env`],
      cache: true,
    }),
    AuthModule,
    PrismaModule,
    ProfilesModule,
    GeocodingModule,
    PoiModule,
    MatrixRoutingModule,
    RedisModule,
    BullMQModule,
    TimezoneModule,
    UserSettingsModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

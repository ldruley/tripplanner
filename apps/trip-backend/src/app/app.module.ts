import { Module } from '@nestjs/common';
import { ConfigValidationModule } from '@trip-planner/config';
import { PrismaModule } from '@trip-planner/prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OpenApiController } from './openapi.controller';
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
import { RoutingModule } from '@trip-planner/routing';
import { TripModule } from '@trip-planner/trip';
import { StopModule } from '@trip-planner/stop';
import { LocationModule } from '@trip-planner/location';
import { TravelSegmentModule } from '@trip-planner/travel-segment';
import { TimelineModule } from '@trip-planner/timeline';
import { ItineraryModule } from '@trip-planner/itinerary';

@Module({
  imports: [
    ConfigValidationModule.forRoot(),
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
    RoutingModule,
    TripModule,
    StopModule,
    LocationModule,
    TravelSegmentModule,
    TimelineModule,
    ItineraryModule,
  ],
  controllers: [AppController, OpenApiController],
  providers: [AppService],
})
export class AppModule {}

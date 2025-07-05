import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@trip-planner/redis';
import { ApiUsageModule } from '@trip-planner/api-usage';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { HereRoutingAdapterService } from './here/here-routing-adapter.service';
import { MapboxRoutingAdapterService } from './mapbox/mapbox-routing-adapter.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    RedisModule,
    ApiUsageModule,
  ],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    HereRoutingAdapterService,
    MapboxRoutingAdapterService,
  ],
  exports: [
    RoutingService,
    HereRoutingAdapterService,
    MapboxRoutingAdapterService,
  ],
})
export class RoutingModule {}
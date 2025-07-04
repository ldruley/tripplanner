import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapboxGeocodeAdapterService } from './mapbox/mapbox-geocode-adapter.service';
import { GeocodingController } from './geocoding.controller';
import { ConfigModule } from '@nestjs/config';
import { HereGeocodeAdapterService } from './here/here-geocode-adapter.service';
import { HttpModule } from '@nestjs/axios';
import { ApiUsageModule } from '@trip-planner/api-usage';

@Module({
  imports: [ConfigModule, HttpModule, ApiUsageModule],
  controllers: [GeocodingController],
  providers: [GeocodingService, HereGeocodeAdapterService, MapboxGeocodeAdapterService],
  exports: [GeocodingService],
})
export class GeocodingModule {}

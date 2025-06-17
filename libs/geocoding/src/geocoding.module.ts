import { Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { MapboxAdapterService } from './mapbox/mapbox-adapter-service';
import { GeocodingController } from './geocoding.controller';
import { ConfigService } from '@nestjs/config';
import { MapboxModule } from './mapbox/mapbox.module';

@Module({
  imports: [MapboxModule],
  controllers: [GeocodingController],
  providers: [GeocodingService],
  exports: [GeocodingService],
})
export class GeocodingModule {}

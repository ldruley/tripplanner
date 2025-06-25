import { Module } from '@nestjs/common';
import { PoiService } from './poi.service';
import { PoiController } from './poi.controller';
import { ConfigModule } from '@nestjs/config';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { HttpModule } from '@nestjs/axios';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';
import { ApiUsageModule } from '@trip-planner/api-usage';

@Module({
  imports: [ConfigModule, HttpModule, ApiUsageModule],
  controllers: [PoiController],
  providers: [PoiService, MapboxPoiAdapterService, HerePoiAdapterService],
  exports: [PoiService],
})
export class PoiModule {}

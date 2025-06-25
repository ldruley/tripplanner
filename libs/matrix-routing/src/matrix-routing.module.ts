import { Module } from '@nestjs/common';
import { MatrixRoutingService } from './matrix-routing.service';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MatrixRoutingController } from './matrix-routing.controller';
import { MapboxMatrixRoutingAdapterService } from './mapbox/mapbox-matrix-routing-adapter.service';
import { ApiUsageModule } from '@trip-planner/api-usage';

@Module({
  imports: [ConfigModule, HttpModule, ApiUsageModule],
  controllers: [MatrixRoutingController],
  providers: [MatrixRoutingService, HereMatrixRoutingAdapterService, MapboxMatrixRoutingAdapterService],
  exports: [MatrixRoutingService],
})
export class MatrixRoutingModule {}

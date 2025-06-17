import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapboxAdapterService } from './mapbox-adapter-service';

@Module({
  imports: [ConfigModule],
  providers: [MapboxAdapterService],
  exports: [MapboxAdapterService],
})
export class MapboxModule {}

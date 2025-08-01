import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { StopService } from './stop.service';
import { StopRepository } from './stop.repository';
import { StopController } from './stop.controller';
import { TripModule } from '@trip-planner/trip';

@Module({
  imports: [PrismaModule, TripModule],
  controllers: [StopController],
  providers: [StopService, StopRepository],
  exports: [StopService, StopRepository],
})
export class StopModule {}

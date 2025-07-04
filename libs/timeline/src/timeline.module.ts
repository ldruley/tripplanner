import { Module } from '@nestjs/common';
import { TimelineService } from './timeline.service';

@Module({
  controllers: [],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}

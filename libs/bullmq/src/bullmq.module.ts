import { Module, Global } from '@nestjs/common';
import { ConfigValidationModule } from '@trip-planner/config';
import { BullMQService } from './bullmq.service';

@Global()
@Module({
  imports: [ConfigValidationModule.forRoot()],
  providers: [BullMQService],
  exports: [BullMQService],
})
export class BullMQModule {}

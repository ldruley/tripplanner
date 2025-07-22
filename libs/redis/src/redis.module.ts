import { Global, Module } from '@nestjs/common';
import { ConfigValidationModule } from '@trip-planner/config';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigValidationModule.forRoot()],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}

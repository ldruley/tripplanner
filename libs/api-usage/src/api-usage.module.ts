import { Module } from '@nestjs/common';
import { ApiUsageService } from './api-usage.service';
import { QuotaModule } from '@trip-planner/quota';

@Module({
  imports: [QuotaModule],
  providers: [ApiUsageService],
  exports: [ApiUsageService],
})
export class ApiUsageModule {}

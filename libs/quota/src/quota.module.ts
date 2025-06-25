import { Module } from '@nestjs/common';
import { QuotaService } from './quote.service';

@Module({
  providers: [QuotaService],
  exports: [QuotaService],
})
export class QuotaModule {}

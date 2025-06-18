import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { MatrixQueryDto } from '../../shared/types/src/schemas/matrix.schema';


@Injectable()
export class MatrixRoutingService {
  private readonly CACHE_TTL_MS  = 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(MatrixRoutingService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly hereAdapter: HereMatrixRoutingAdapterService,
  ) {}

  async getMatrixRouting(query: MatrixQueryDto): Promise<any> {
    return this.hereAdapter.getMatrixRouting(query);
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { CoordinateMatrix, MatrixQueryDto } from '../../shared/types/src/schemas/matrix.schema';
import { createHash } from 'crypto';


@Injectable()
export class MatrixRoutingService {
  private readonly CACHE_TTL_MS  = 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(MatrixRoutingService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly hereAdapter: HereMatrixRoutingAdapterService,
    private readonly mapBoxAdapter: HereMatrixRoutingAdapterService,
  ) {}

  async getMatrixRouting(query: MatrixQueryDto): Promise<CoordinateMatrix> {
    const cacheKey = this.createCacheKey(query);

    const cachedResult = await this.cacheManager.get<CoordinateMatrix>(cacheKey);
    if(cachedResult) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`, MatrixRoutingService.name);
      return cachedResult;
    }
    this.logger.log(`Cache MISS for key: ${cacheKey}, fetching new data`, MatrixRoutingService.name);

    //const results = await this.hereAdapter.getMatrixRouting(query);
    const results = await this.mapBoxAdapter.getMatrixRouting(query);
    if (results) {
      await this.cacheManager.set(cacheKey, results, this.CACHE_TTL_MS);
    }
    return results;
  }

  createCacheKey(query: MatrixQueryDto): string {
    const sorted = query.origins.map(coord =>
      `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`
    ).slice().sort().join('|');
    const hash = createHash('sha256').update(sorted).digest('hex');
    return `MATRIX_ROUTING_:${hash}`;
  }
}

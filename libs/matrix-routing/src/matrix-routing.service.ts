import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { CoordinateMatrix, MatrixQueryDto } from '../../shared/types/src/schemas/matrix.schema';
import { createHash } from 'crypto';
import { RedisService } from '../../redis/src/redis.service';
import { ApiUsageService } from '../../api-usage/src/api-usage.service';


@Injectable()
export class MatrixRoutingService {
  private readonly CACHE_TTL_MS  = 24 * 60 * 60;
  private readonly logger = new Logger(MatrixRoutingService.name);

  constructor(
    private readonly hereAdapter: HereMatrixRoutingAdapterService,
    private readonly mapBoxAdapter: HereMatrixRoutingAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService
  ) {}

  async getMatrixRouting(query: MatrixQueryDto): Promise<CoordinateMatrix> {
    const cacheKey = this.createCacheKey(query);

    const cachedResult = await this.redisService.get<CoordinateMatrix>(cacheKey);
    if(cachedResult) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`, MatrixRoutingService.name);
      return cachedResult;
    }
    this.logger.log(`Cache MISS for key: ${cacheKey}, fetching new data`, MatrixRoutingService.name);
    let results: CoordinateMatrix;
    //TODO: Additional logic to assign providers based on query size
    if(await this.apiUsageService.checkQuota('mapbox', 'matrix-routing')) {
      results = await this.mapBoxAdapter.getMatrixRouting(query);
      await this.apiUsageService.increment('mapbox', 'matrix-routing');
    } else if(await this.apiUsageService.checkQuota('here', 'matrix-routing')) {
      results = await this.hereAdapter.getMatrixRouting(query);
      await this.apiUsageService.increment('here', 'matrix-routing');
    } else {
      throw new Error('No API quota available for matrix routing');
    }
    if (results) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
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

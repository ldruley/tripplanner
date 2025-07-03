import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { MapboxMatrixRoutingAdapterService } from './mapbox/mapbox-matrix-routing-adapter.service';
import { RedisService } from '@trip-planner/redis';
import { ApiUsageService } from '@trip-planner/api-usage';
import { buildCacheKey } from '@trip-planner/utils';
import { CoordinateMatrix, MatrixQuery } from '@trip-planner/types';

@Injectable()
export class MatrixRoutingService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(MatrixRoutingService.name);

  constructor(
    private readonly hereAdapter: HereMatrixRoutingAdapterService,
    private readonly mapBoxAdapter: MapboxMatrixRoutingAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  async getMatrixRouting(query: MatrixQuery): Promise<CoordinateMatrix> {
    const cacheKey = buildCacheKey('matrix:routing', [query], true);
    return this.redisService.getOrSet(cacheKey, this.CACHE_TTL_MS, () =>
      this.implementMatrixStrategy(query),
    );
  }

  async implementMatrixStrategy(query: MatrixQuery): Promise<CoordinateMatrix> {
    let results: CoordinateMatrix;
    //TODO: Additional logic to assign providers based on query size
    if (await this.apiUsageService.checkQuota('mapbox', 'matrix-routing')) {
      this.logger.log('Using Mapbox for matrix routing', MatrixRoutingService.name);
      results = await this.mapBoxAdapter.getMatrixRouting(query);
      await this.apiUsageService.increment('mapbox', 'matrix-routing');
    } else if (await this.apiUsageService.checkQuota('here', 'matrix-routing')) {
      results = await this.hereAdapter.getMatrixRouting(query);
      await this.apiUsageService.increment('here', 'matrix-routing');
    } else {
      throw new ServiceUnavailableException('No API quota available for matrix routing');
    }
    return results;
  }
}

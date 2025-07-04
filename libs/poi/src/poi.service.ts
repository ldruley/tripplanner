import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';
import { ApiUsageService } from '@trip-planner/api-usage';
import { buildCacheKey } from '@trip-planner/utils';
import { PoiSearchQuery, PoiSearchResult } from '@trip-planner/types';
import { RedisService } from '@trip-planner/redis';

@Injectable()
export class PoiService {
  private readonly CACHE_TTL_MS = 3 * 24 * 60 * 60;
  private readonly logger = new Logger(PoiService.name);

  constructor(
    private readonly mapboxAdapter: MapboxPoiAdapterService,
    private readonly hereAdapter: HerePoiAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  async poiSearch(query: PoiSearchQuery): Promise<PoiSearchResult[]> {
    const cacheKey = buildCacheKey('poi:search', [query], true);
    return this.redisService.getOrSet(cacheKey, this.CACHE_TTL_MS, () =>
      this.implementStrategy(query),
    );
  }

  async implementStrategy(query: PoiSearchQuery): Promise<PoiSearchResult[]> {
    let results;
    if (await this.apiUsageService.checkQuota('here', 'poi')) {
      results = await this.hereAdapter.searchPoi(query);
      await this.apiUsageService.increment('here', 'poi');
    } else if (await this.apiUsageService.checkQuota('mapbox', 'poi')) {
      results = await this.mapboxAdapter.searchPoi(query);
      await this.apiUsageService.increment('mapbox', 'poi');
    } else {
      throw new ServiceUnavailableException('No API quota available for POI search');
    }
    return results;
  }
}

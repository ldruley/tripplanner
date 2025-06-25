import { Injectable, Inject, Logger } from '@nestjs/common';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { PoiSearchQuery, PoiSearchResult } from '../../shared/types/src/schemas/search.schema';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';
import { RedisService } from '../../redis/src/redis.service';
import { ApiUsageService } from '../../api-usage/src/api-usage.service';


@Injectable()
export class PoiService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(PoiService.name);

  constructor(
    private readonly mapboxAdapter: MapboxPoiAdapterService,
    private readonly hereAdapter: HerePoiAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService
  ) {}

  async poiSearch(query: PoiSearchQuery): Promise<PoiSearchResult[] | null> {
    const cacheKey = `POI_SEARCH_:${query.search}:${query.limit}`;

    const cachedResult = await this.redisService.get(cacheKey);

    if (cachedResult) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache miss for key: ${cacheKey}. Fetching from Mapbox.`);
    let results;
    if(await this.apiUsageService.checkQuota('here', 'poi')) {
      results = await this.hereAdapter.searchPoi(query);
      await this.apiUsageService.increment('here', 'poi');
    } else if(await this.apiUsageService.checkQuota('mapbox', 'poi')) {
      results = await this.mapboxAdapter.searchPoi(query);
      await this.apiUsageService.increment('mapbox', 'poi');
    }
    if (results && results.length > 0) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
    } else {
      return null;
    }
    return results;
  }

}

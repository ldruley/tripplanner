import { Injectable, Inject, Logger } from '@nestjs/common';
import {CACHE_MANAGER} from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { PoiSearchQueryDto } from '../../shared/types/src/schemas/search.schema';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';
import { RedisService } from '../../redis/src/redis.service';


@Injectable()
export class PoiService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(PoiService.name);

  constructor(
    private readonly mapboxAdapter: MapboxPoiAdapterService,
    private readonly hereAdapter: HerePoiAdapterService,
    private readonly redisService: RedisService,
  ) {}

  async poiSearch(query: PoiSearchQueryDto): Promise<any> {
    const cacheKey = `POI_SEARCH_:${query.search}:${query.limit}`;

    const cachedResult = await this.redisService.get(cacheKey);

    if (cachedResult) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache miss for key: ${cacheKey}. Fetching from Mapbox.`);
    const result = await this.hereAdapter.searchPoi(query);

    await this.redisService.set(cacheKey, result, this.CACHE_TTL_MS);
    return result;
  }

}

import { Injectable, Inject, Logger } from '@nestjs/common';
import {CACHE_MANAGER} from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';


@Injectable()
export class PoiService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(PoiService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly mapboxAdapter: MapboxPoiAdapterService
  ) {}

  async poiSearch(search: string, limit: 10): Promise<any> {
    const cacheKey = `POI_SEARCH_:${search}:${limit}`;

    const cachedResult = await this.cacheManager.get(cacheKey);

    if (cachedResult) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache miss for key: ${cacheKey}. Fetching from Mapbox.`);
    const result = await this.mapboxAdapter.searchPoi(search, limit);

    await this.cacheManager.set(cacheKey, result, { ttl: this.CACHE_TTL_MS });
    return result;
  }

}

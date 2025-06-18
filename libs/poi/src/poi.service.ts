import { Injectable, Inject, Logger } from '@nestjs/common';
import {CACHE_MANAGER} from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { PoiSearchQueryDto } from '../../shared/types/src/schemas/search.schema';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';


@Injectable()
export class PoiService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(PoiService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly mapboxAdapter: MapboxPoiAdapterService,
    private readonly hereAdapter: HerePoiAdapterService,
  ) {}

  async poiSearch(query: PoiSearchQueryDto): Promise<any> {
    const cacheKey = `POI_SEARCH_:${query.search}:${query.limit}`;

    const cachedResult = await this.cacheManager.get(cacheKey);

    if (cachedResult) {
      this.logger.log(`Cache hit for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache miss for key: ${cacheKey}. Fetching from Mapbox.`);
    const result = await this.hereAdapter.searchPoi(query.search);

    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL_MS);
    return result;
  }

}

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MapboxGeocodeAdapterService } from './mapbox/mapbox-geocode-adapter.service';
import { HereGeocodeAdapterService } from './here/here-geocode-adapter.service';
import { RedisService } from '@trip-planner/redis';
import { ApiUsageService } from '@trip-planner/api-usage';
import { buildCacheKey } from '@trip-planner/utils';
import { ForwardGeocodeQuery, GeocodingResult, ReverseGeocodeQuery } from '@trip-planner/types';

@Injectable()
export class GeocodingService {
  private readonly CACHE_TTL_MS = 3 * 24 * 60 * 60;
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly mapboxAdapter: MapboxGeocodeAdapterService,
    private readonly hereAdapter: HereGeocodeAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<GeocodingResult[]> {
    const cacheKey = buildCacheKey('geocode:forward', [query], true);
    return this.redisService.getOrSet(cacheKey, this.CACHE_TTL_MS, () =>
      this.implementForwardGeocodeStrategy(query),
    );
  }

  async implementForwardGeocodeStrategy(query: ForwardGeocodeQuery): Promise<GeocodingResult[]> {
    let results: GeocodingResult[] = [];
    if (await this.apiUsageService.checkQuota('here', 'geocoding')) {
      results = await this.hereAdapter.forwardGeocode(query);
      await this.apiUsageService.increment('here', 'geocoding');
    } else if (await this.apiUsageService.checkQuota('mapbox', 'geocoding')) {
      results = await this.mapboxAdapter.forwardGeocode(query);
      await this.apiUsageService.increment('mapbox', 'geocoding');
    } else {
      throw new ServiceUnavailableException('No geocoding provider available or quota exceeded');
    }
    return results;
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<GeocodingResult[]> {
    const cacheKey = buildCacheKey('geocode:reverse', [query], true);
    return this.redisService.getOrSet(cacheKey, this.CACHE_TTL_MS, () =>
      this.implementReverseGeocodeStrategy(query),
    );
  }

  async implementReverseGeocodeStrategy(query: ReverseGeocodeQuery): Promise<GeocodingResult[]> {
    let results: GeocodingResult[] = [];
    if (await this.apiUsageService.checkQuota('here', 'geocoding')) {
      results = await this.hereAdapter.reverseGeocode(query);
      await this.apiUsageService.increment('here', 'geocoding');
    } else if (await this.apiUsageService.checkQuota('mapbox', 'geocoding')) {
      results = await this.mapboxAdapter.reverseGeocode(query);
      await this.apiUsageService.increment('mapbox', 'geocoding');
    } else {
      throw new ServiceUnavailableException('No geocoding provider available or quota exceeded');
    }
    return results;
  }
}

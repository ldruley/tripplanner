import { Injectable, Logger } from '@nestjs/common';
import { MapboxGeocodeAdapterService } from './mapbox/mapbox-geocode-adapter.service';
import {
  ForwardGeocodeQuery,
  GeocodingResult, ReverseGeocodeQuery,
} from '../../shared/types/src/schemas/geocoding.schema';
import { HereGeocodeAdapterService } from './here/here-geocode-adapter.service';
import { RedisService } from '../../redis/src/redis.service';
import { ApiUsageService } from '../../api-usage/src/api-usage.service';

@Injectable()
export class GeocodingService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly mapboxAdapter: MapboxGeocodeAdapterService,
    private readonly hereAdapter: HereGeocodeAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService
  ) {}

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_FORWARD_${query.search.toUpperCase().replace(/\s/g, '_')}`;

    // Check if the result is cached
    const cachedResult = await this.redisService.get<GeocodingResult[]>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // Not cached, get results from a geocoding provider
    let results: GeocodingResult[] = [];
    if(await this.apiUsageService.checkQuota("here", "geocoding")) {
      results = await this.hereAdapter.forwardGeocode(query);
      await this.apiUsageService.increment("here", "geocoding");
    } else if(await this.apiUsageService.checkQuota("mapbox", "geocoding")) {
      results = await this.mapboxAdapter.forwardGeocode(query);
      await this.apiUsageService.increment("mapbox", "geocoding");
    } else {
      throw new Error("No geocoding provider available or quota exceeded");
    }
    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    //TODO: Persisting locations potentially
    return results;
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_REVERSE_${query.latitude}_${query.longitude}`;

    const cachedData = await this.redisService.get<GeocodingResult[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedData;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // If not cached, get from a geocoding provider
    let results: GeocodingResult[] = [];
    if(await this.apiUsageService.checkQuota('here', 'geocoding')) {
      results = await this.mapboxAdapter.reverseGeocode(query);
      await this.apiUsageService.increment('here', 'geocoding');
    } else if(await this.apiUsageService.checkQuota('mapbox', 'geocoding')) {
      results = await this.hereAdapter.reverseGeocode(query);
      await this.apiUsageService.increment('mapbox', 'geocoding');
    } else {
      throw new Error('No geocoding provider available or quota exceeded');
    }

    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    return results;
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MapboxGeocodeAdapterService } from './mapbox/mapbox-geocode-adapter.service';
import {
  ForwardGeocodeQueryDto,
  GeocodingResult,
  ReverseGeocodeQueryDto
} from '../../shared/types/src/schemas/geocoding.schema';
import { HereGeocodeAdapterService } from './here/here-geocode-adapter.service';
import { RedisService } from '../../redis/src/redis.service';

@Injectable()
export class GeocodingService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly mapboxAdapter: MapboxGeocodeAdapterService,
    private readonly hereAdapter: HereGeocodeAdapterService,
    private readonly redisService: RedisService,
  ) {}

  async forwardGeocode(query: ForwardGeocodeQueryDto): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_FORWARD_${query.search.toUpperCase().replace(/\s/g, '_')}`;

    // Check if the result is cached
    const cachedResult = await this.redisService.get<GeocodingResult[]>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // If not cached, call the Mapbox adapter service - later we can add more adapters
    //const results = await this.mapboxAdapter.forwardGeocode(query);
    const results = await this.hereAdapter.forwardGeocode(query);
    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    //TODO: Persisting locations potentially
    return results;
  }

  async reverseGeocode(query: ReverseGeocodeQueryDto): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_REVERSE_${query.latitude}_${query.longitude}`;

    const cachedData = await this.redisService.get<GeocodingResult[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedData;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // If not cached, call the Mapbox adapter service - later we can add more adapters
    const results = await this.mapboxAdapter.reverseGeocode(query);

    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.redisService.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    return results;
  }

}


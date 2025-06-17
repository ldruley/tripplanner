import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MapboxAdapterService } from './mapbox/mapbox-adapter-service';
import { GeocodingResult } from '../../shared/types/src/schemas/geocoding.schema';

@Injectable()
export class GeocodingService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly mapboxAdapter: MapboxAdapterService
  ) {}

  async forwardGeocode(search: string): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_FORWARD_${search.toUpperCase().replace(/\s/g, '_')}`;

    // Check if the result is cached
    const cachedResult = await this.cacheManager.get<GeocodingResult[]>(cacheKey);
    if (cachedResult) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedResult;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // If not cached, call the Mapbox adapter service - later we can add more adapters
    const results = await this.mapboxAdapter.forwardGeocode(search);

    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.cacheManager.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    //TODO: Persisting locations potentially
    return results;
  }

  async reverseGeocode(lat: number, lon: number): Promise<GeocodingResult[]> {
    const cacheKey = `GEOCODE_REVERSE_${lat}_${lon}`;

    const cachedData = await this.cacheManager.get<GeocodingResult[]>(cacheKey);
    if (cachedData) {
      this.logger.log(`Cache HIT for key: ${cacheKey}`);
      return cachedData;
    }

    this.logger.log(`Cache MISS for key: ${cacheKey}. Fetching from provider.`);
    // If not cached, call the Mapbox adapter service - later we can add more adapters
    const results = await this.mapboxAdapter.reverseGeocode(lat, lon);

    // Cache the result for future requests
    if (results && results.length > 0) {
      await this.cacheManager.set(cacheKey, results, this.CACHE_TTL_MS);
    }

    return results;
  }

}


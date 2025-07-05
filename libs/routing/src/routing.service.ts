import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HereRoutingAdapterService } from './here/here-routing-adapter.service';
import { MapboxRoutingAdapterService } from './mapbox/mapbox-routing-adapter.service';
import { RedisService } from '@trip-planner/redis';
import { ApiUsageService } from '@trip-planner/api-usage';
import { buildCacheKey } from '@trip-planner/utils';
import { Route, RoutingRequest, RoutingResponse } from '@trip-planner/types';

@Injectable()
export class RoutingService {
  private readonly CACHE_TTL_MS = 24 * 60 * 60;
  private readonly logger = new Logger(RoutingService.name);
  private readonly MAPBOX_WAYPOINT_LIMIT = 25;

  constructor(
    private readonly hereAdapter: HereRoutingAdapterService,
    private readonly mapboxAdapter: MapboxRoutingAdapterService,
    private readonly redisService: RedisService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  /**
   * Get routing information for a set of waypoints.
   * Uses Mapbox by default, switches to HERE for >25 waypoints or when Mapbox quota is exhausted.
   * @param request - RoutingRequest containing waypoints and options
   * @return RoutingResponse - with route, provider, waypoint count, and raw response
   */
  async getRouting(request: RoutingRequest): Promise<RoutingResponse> {
    // Create cache key excluding time-sensitive parameters
    const cacheKey = this.buildCacheKey(request);

    return this.redisService.getOrSet(cacheKey, this.CACHE_TTL_MS, () =>
      this.implementProviderStrategy(request),
    );
  }

  /**
   * Implement the provider strategy based on waypoint count and API quotas.
   * - Use Mapbox for <=25 waypoints if quota allows
   * - Switch to HERE for >25 waypoints or if Mapbox quota is exhausted
   * @param request - RoutingRequest containing waypoints and options
   * @return RoutingResponse - with route, provider, waypoint count, and raw response
   */
  private async implementProviderStrategy(request: RoutingRequest): Promise<RoutingResponse> {
    const waypointCount = request.waypoints.length;
    let route: Route;
    let rawResponse: any;
    let provider: 'HERE' | 'MAPBOX';

    // Strategy: Use Mapbox by default, switch to HERE for >25 waypoints OR if Mapbox quota exhausted
    if (waypointCount <= this.MAPBOX_WAYPOINT_LIMIT) {
      // Try Mapbox first (preferred for <=25 waypoints)
      if (await this.apiUsageService.checkQuota('mapbox', 'routing')) {
        this.logger.log(
          `Using Mapbox for routing (${waypointCount} waypoints)`,
          RoutingService.name,
        );
        const result = await this.mapboxAdapter.getRouting(request);
        route = result.route;
        rawResponse = result.rawResponse;
        await this.apiUsageService.increment('mapbox', 'routing');
        provider = 'MAPBOX';
      } else if (await this.apiUsageService.checkQuota('here', 'routing')) {
        this.logger.log(
          `Mapbox quota exhausted, using HERE for routing (${waypointCount} waypoints)`,
          RoutingService.name,
        );
        const result = await this.hereAdapter.getRouting(request);
        route = result.route;
        rawResponse = result.rawResponse;
        await this.apiUsageService.increment('here', 'routing');
        provider = 'HERE';
      } else {
        throw new ServiceUnavailableException('No API quota available for routing');
      }
    } else {
      // Use HERE for >25 waypoints (Mapbox limit exceeded)
      if (await this.apiUsageService.checkQuota('here', 'routing')) {
        this.logger.log(
          `Using HERE for routing (${waypointCount} waypoints, exceeds Mapbox limit)`,
          RoutingService.name,
        );
        const result = await this.hereAdapter.getRouting(request);
        route = result.route;
        rawResponse = result.rawResponse;
        await this.apiUsageService.increment('here', 'routing');
        provider = 'HERE';
      } else {
        throw new ServiceUnavailableException(
          'No HERE API quota available for routing with >25 waypoints',
        );
      }
    }

    return {
      route,
      provider,
      waypointCount,
      requestedAt: new Date(),
      rawResponse,
    };
  }

  /**
   * Build cache key for routing request, excluding time-sensitive parameters.
   * @param request - RoutingRequest containing waypoints and options
   * @return string - cache key for the request
   */
  private buildCacheKey(request: RoutingRequest): string {
    // Create a cache-friendly version of the request
    const cacheableRequest = {
      waypoints: request.waypoints,
      options: {
        travelMode: request.options?.travelMode,
        avoidTolls: request.options?.avoidTolls,
        avoidHighways: request.options?.avoidHighways,
        avoidFerries: request.options?.avoidFerries,
        // Exclude timeAware and departureTime from cache key
      },
    };

    return buildCacheKey('routing', [cacheableRequest], true);
  }

  /**
   * Get routing with a specific provider (for testing or specific requirements).
   * @param request - RoutingRequest containing waypoints and options
   * @param provider - 'HERE' or 'MAPBOX'
   * @return RoutingResponse - with route, provider, waypoint count, and raw response
   */
  async getRoutingWithProvider(
    request: RoutingRequest,
    provider: 'HERE' | 'MAPBOX',
  ): Promise<RoutingResponse> {
    let route: Route;
    let rawResponse: any;

    if (provider === 'MAPBOX') {
      if (request.waypoints.length > this.MAPBOX_WAYPOINT_LIMIT) {
        throw new ServiceUnavailableException(
          `Mapbox supports maximum ${this.MAPBOX_WAYPOINT_LIMIT} waypoints`,
        );
      }

      if (!(await this.apiUsageService.checkQuota('mapbox', 'routing'))) {
        throw new ServiceUnavailableException('Mapbox routing quota exhausted');
      }

      const result = await this.mapboxAdapter.getRouting(request);
      route = result.route;
      rawResponse = result.rawResponse;
      await this.apiUsageService.increment('mapbox', 'routing');
    } else {
      if (!(await this.apiUsageService.checkQuota('here', 'routing'))) {
        throw new ServiceUnavailableException('HERE routing quota exhausted');
      }

      const result = await this.hereAdapter.getRouting(request);
      route = result.route;
      rawResponse = result.rawResponse;
      await this.apiUsageService.increment('here', 'routing');
    }

    return {
      route,
      provider,
      waypointCount: request.waypoints.length,
      requestedAt: new Date(),
      rawResponse,
    };
  }

  /**
   * Check if a routing request can be handled by Mapbox based on waypoint count.
   * @param waypointCount - Number of waypoints in the request
   * @return boolean - true if Mapbox can handle the request, false otherwise
   */
  canUseMapbox(waypointCount: number): boolean {
    return waypointCount <= this.MAPBOX_WAYPOINT_LIMIT;
  }

  /**
   * Get the recommended provider for a given waypoint count.
   * @param waypointCount - Number of waypoints in the request
   * @return 'HERE' | 'MAPBOX' - recommended provider based on waypoint count
   */
  getRecommendedProvider(waypointCount: number): 'HERE' | 'MAPBOX' {
    return waypointCount <= this.MAPBOX_WAYPOINT_LIMIT ? 'MAPBOX' : 'HERE';
  }
}

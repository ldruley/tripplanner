import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { Route, RouteSchema, RoutingRequest, Waypoint, RouteLeg } from '@trip-planner/types';
import { MapboxRoutingApiResponse } from '@trip-planner/types';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MapboxRoutingAdapterService {
  private readonly logger = new Logger(MapboxRoutingAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey =
      this.configService.get<string>('MAPBOX_API_KEY') ??
      (() => {
        this.logger.error('MAPBOX_API_KEY is not set');
        throw new InternalServerErrorException('MAPBOX_API_KEY is not set');
      })();

    this.baseUrl =
      this.configService.get<string>('MAPBOX_BASE_URL') ??
      (() => {
        this.logger.error('MAPBOX_BASE_URL is not set');
        throw new InternalServerErrorException('MAPBOX_BASE_URL is not set');
      })();
  }

  /**
   * Fetch routing data from Mapbox API based on the provided request.
   * @param request - The routing request containing waypoints and options.
   * @return A promise that resolves to an object containing the route and raw response data.
   * TODO: type the raw response properly
   */
  async getRouting(request: RoutingRequest): Promise<{ route: Route; rawResponse: any }> {
    const url = this.buildMapboxRoutingUrl(request);

    this.logger.debug(`Mapbox Routing URL: ${url}`);

    try {
      const response: AxiosResponse<MapboxRoutingApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );

      this.logger.debug('Mapbox routing response received');
      const route = this.mapMapboxResponseToRoute(response.data, request.waypoints);
      return { route, rawResponse: response.data };
    } catch (error) {
      this.logger.error('Error fetching routing from Mapbox: ' + error);
      throw new BadGatewayException('Failed to fetch routing from Mapbox');
    }
  }

  /**
   * Build the Mapbox routing URL based on the request parameters.
   * @param request - The routing request containing waypoints and options.
   * @return The complete Mapbox routing URL.
   */
  private buildMapboxRoutingUrl(request: RoutingRequest): string {
    const { waypoints, options } = request;

    // Build coordinates string (longitude,latitude format for Mapbox)
    const coordinates = waypoints.map(wp => `${wp.longitude},${wp.latitude}`).join(';');

    // Determine travel profile
    const profile = this.mapTravelModeToMapbox(options?.travelMode || 'DRIVING');

    const baseUrl = `${this.baseUrl}/directions/v5/mapbox/${profile}/${coordinates}`;

    const params = new URLSearchParams();

    // Request route geometry and leg information
    params.append('geometries', 'polyline');
    params.append('overview', 'full');
    params.append('steps', 'true'); // Enable steps to get detailed leg geometry

    // Add API key
    params.append('access_token', this.apiKey);

    // Add avoidance options
    const excludeOptions: string[] = [];
    if (options?.avoidTolls) {
      excludeOptions.push('toll');
    }
    if (options?.avoidHighways) {
      excludeOptions.push('motorway');
    }
    if (options?.avoidFerries) {
      excludeOptions.push('ferry');
    }

    if (excludeOptions.length > 0) {
      params.append('exclude', excludeOptions.join(','));
    }

    // Note: Time-aware routing not yet implemented for Mapbox
    // Would use departure_time parameter when available

    return `${baseUrl}?${params.toString()}`;
  }

  private mapTravelModeToMapbox(travelMode: string): string {
    switch (travelMode) {
      case 'DRIVING':
        return 'driving-traffic';
      case 'WALKING':
        return 'walking';
      case 'BICYCLING':
        return 'cycling';
      case 'TRANSIT':
      case 'PUBLIC_TRANSPORT':
        // Mapbox doesn't have a direct public transport profile
        // Fall back to walking for now
        return 'walking';
      default:
        return 'driving-traffic';
    }
  }

  /**
   * Map the Mapbox API response to our Route schema.
   * @param response - The Mapbox API response containing routing data.
   * @param waypoints - The original waypoints from the request.
   * @return A Route object conforming to our RouteSchema.
   */
  private mapMapboxResponseToRoute(
    response: MapboxRoutingApiResponse,
    waypoints: Waypoint[],
  ): Route {
    if (!response.routes || response.routes.length === 0) {
      throw new BadGatewayException('No routes found in Mapbox response');
    }

    const route = response.routes[0];

    // Map legs with geometry if available
    const legs: RouteLeg[] = route.legs.map((leg, index) => ({
      distance: leg.distance,
      duration: leg.duration,
      startWaypoint: waypoints[index],
      endWaypoint: waypoints[index + 1],
      geometry: leg.geometry || route.geometry, // Use leg geometry if available, fallback to route geometry
    }));

    const mappedRoute: Route = {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      legs,
      waypointOrder: route.waypoint_order,
    };

    return RouteSchema.parse(mappedRoute);
  }
}

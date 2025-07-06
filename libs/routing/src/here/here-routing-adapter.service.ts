import { ValidationConfigService } from '@trip-planner/config';
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { Route, RouteSchema, RoutingRequest, Waypoint, RouteLeg } from '@trip-planner/types';
import { HereRoutingApiResponse } from '@trip-planner/types';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HereRoutingAdapterService {
  private readonly logger = new Logger(HereRoutingAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ValidationConfigService,
    private readonly httpService: HttpService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    const apiUrls = this.configService.getApiUrls();
    
    this.apiKey = apiKeys.HERE_API_KEY;
    this.baseUrl = apiUrls.HERE_ROUTING_URL;
  }

  /**
   * Fetch routing data from HERE API based on the provided request.
   * @param request - The routing request containing waypoints and options.
   * @return A promise that resolves to an object containing the route and raw response data.
   */
  async getRouting(request: RoutingRequest): Promise<{ route: Route; rawResponse: any }> {
    const url = this.buildHereRoutingUrl(request);
    this.logger.debug(`HERE Routing URL: ${url}`);

    try {
      const response: AxiosResponse<HereRoutingApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );

      this.logger.debug('HERE routing response received');
      const route = this.mapHereResponseToRoute(response.data, request.waypoints);
      return { route, rawResponse: response.data };
    } catch (error: any) {
      this.logger.error('Error fetching routing from HERE:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url,
      });

      if (error.response?.data) {
        throw new BadGatewayException(`HERE API Error: ${JSON.stringify(error.response.data)}`);
      }

      throw new BadGatewayException('Failed to fetch routing from HERE');
    }
  }

  /**
   * Build the HERE routing URL based on the request parameters.
   * @param request - The routing request containing waypoints and options.
   * @return The complete URL for the HERE routing API.
   */
  private buildHereRoutingUrl(request: RoutingRequest): string {
    const { waypoints, options } = request;
    const baseUrl = `${this.baseUrl}/v8/routes`;

    const params = new URLSearchParams();

    // Add origin (first waypoint) - HERE expects latitude,longitude format
    const origin = waypoints[0];
    params.append('origin', `${origin.latitude},${origin.longitude}`);

    // Add destination (last waypoint) - HERE expects latitude,longitude format
    const destination = waypoints[waypoints.length - 1];
    params.append('destination', `${destination.latitude},${destination.longitude}`);

    // Add via waypoints (intermediate waypoints) - HERE expects latitude,longitude format
    for (let i = 1; i < waypoints.length - 1; i++) {
      const waypoint = waypoints[i];
      params.append('via', `${waypoint.latitude},${waypoint.longitude}`);
    }

    // Add transport mode
    if (options?.travelMode) {
      const hereMode = this.mapTravelModeToHere(options.travelMode);
      params.append('transportMode', hereMode);
    } else {
      params.append('transportMode', 'car');
    }

    // Add return parameters for the data we need
    params.append('return', 'polyline,summary');

    // Add API key
    params.append('apiKey', this.apiKey);

    // Add time-aware routing if requested (but don't use it yet)
    if (options?.timeAware && options?.departureTime) {
      params.append('departureTime', options.departureTime.toISOString());
    }

    // Add avoidance options (temporarily commented out to debug 400 error)
    // const avoid: string[] = [];
    // if (options?.avoidTolls) {
    //   avoid.push('tollRoad');
    // }
    // if (options?.avoidHighways) {
    //   avoid.push('motorway');
    // }
    // if (options?.avoidFerries) {
    //   avoid.push('ferry');
    // }

    // if (avoid.length > 0) {
    //   params.append('avoid[features]', avoid.join(','));
    // }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Map the travel mode from the request to HERE's expected format.
   * @param travelMode - The travel mode from the request (e.g., 'DRIVING', 'WALKING').
   * @return The corresponding HERE transport mode.
   */
  private mapTravelModeToHere(travelMode: string): string {
    switch (travelMode) {
      case 'DRIVING':
        return 'car';
      case 'WALKING':
        return 'pedestrian';
      case 'BICYCLING':
        return 'bicycle';
      case 'TRANSIT':
      case 'PUBLIC_TRANSPORT':
        return 'publicTransport';
      default:
        return 'car';
    }
  }

  /**
   * Map the HERE API response to our Route schema.
   * @param response - The raw response from HERE API.
   * @param waypoints - The original waypoints from the request.
   * @return A Route object containing distance, duration, geometry, and legs.
   */
  private mapHereResponseToRoute(response: HereRoutingApiResponse, waypoints: Waypoint[]): Route {
    if (!response.routes || response.routes.length === 0) {
      throw new BadGatewayException('No routes found in HERE response');
    }

    const route = response.routes[0];

    if (!route.sections || route.sections.length === 0) {
      throw new BadGatewayException('No sections found in HERE route response');
    }

    // Each section in HERE represents a leg between waypoints
    const legs: RouteLeg[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    const geometries: string[] = [];

    // Process each section as a leg
    for (let i = 0; i < route.sections.length; i++) {
      const section = route.sections[i];
      
      if (!section.summary) {
        throw new BadGatewayException(`No summary found in HERE route section ${i}`);
      }

      const legDistance = section.summary.length || 0;
      const legDuration = section.summary.duration || 0;
      
      totalDistance += legDistance;
      totalDuration += legDuration;
      geometries.push(section.polyline);

      // Map section to leg with proper waypoints
      legs.push({
        distance: legDistance,
        duration: legDuration,
        startWaypoint: waypoints[i],
        endWaypoint: waypoints[i + 1],
        geometry: section.polyline, // Each section has its own polyline
      });
    }

    // Validate that we have the expected number of legs
    if (legs.length !== waypoints.length - 1) {
      this.logger.warn(
        `HERE sections count (${legs.length}) does not match expected legs count (${waypoints.length - 1})`
      );
    }

    // Combine all section polylines for the overall route geometry
    // For now, use the first section's polyline as the main geometry
    // TODO: Consider combining polylines properly
    const mainGeometry = route.sections[0].polyline;

    const mappedRoute: Route = {
      distance: totalDistance,
      duration: totalDuration,
      geometry: mainGeometry,
      legs,
    };

    return RouteSchema.parse(mappedRoute);
  }
}

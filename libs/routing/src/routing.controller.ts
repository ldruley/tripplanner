import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { RoutingRequestDto } from '@trip-planner/shared/dtos';
import { RoutingService } from './routing.service';

@ApiTags('routing')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('route')
  @ApiOperation({
    summary: 'Get route between waypoints',
    description:
      'Calculate route using Mapbox (≤25 waypoints) or HERE (>25 waypoints) based on availability',
  })
  @ApiBody({
    description: 'Routing request with waypoints and options',
    examples: {
      'simple-route': {
        summary: 'Simple 2-point route',
        value: {
          waypoints: [
            { latitude: 40.7128, longitude: -74.006, name: 'New York City' },
            { latitude: 40.7589, longitude: -73.9851, name: 'Times Square' },
          ],
        },
      },
      'multi-waypoint-route': {
        summary: 'Route with multiple waypoints',
        value: {
          waypoints: [
            { latitude: 40.7128, longitude: -74.006, name: 'NYC' },
            { latitude: 40.7589, longitude: -73.9851, name: 'Times Square' },
            { latitude: 40.7614, longitude: -73.9776, name: 'Central Park' },
            { latitude: 40.7505, longitude: -73.9934, name: 'Empire State' },
          ],
          options: {
            travelMode: 'DRIVING',
            avoidTolls: false,
            avoidHighways: false,
          },
        },
      },
      'walking-route': {
        summary: 'Walking route with options',
        value: {
          waypoints: [
            { latitude: 51.5074, longitude: -0.1278, name: 'London' },
            { latitude: 51.5014, longitude: -0.1419, name: 'Buckingham Palace' },
          ],
          options: {
            travelMode: 'WALKING',
            avoidHighways: true,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Route calculated successfully',
    schema: {
      type: 'object',
      properties: {
        route: {
          type: 'object',
          properties: {
            distance: { type: 'number', example: 5420.3 },
            duration: { type: 'number', example: 1200 },
            geometry: { type: 'string', example: 'encoded_polyline_string' },
            legs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  distance: { type: 'number' },
                  duration: { type: 'number' },
                  startWaypoint: { type: 'object' },
                  endWaypoint: { type: 'object' },
                },
              },
            },
          },
        },
        provider: { type: 'string', enum: ['HERE', 'MAPBOX'], example: 'MAPBOX' },
        waypointCount: { type: 'number', example: 2 },
        requestedAt: { type: 'string', format: 'date-time' },
        rawResponse: { type: 'object', description: 'Raw API response from the provider for development purposes' },
      },
    },
  })
  async getRoute(@Body() routingRequest: RoutingRequestDto) {
    return await this.routingService.getRouting(routingRequest);
  }

  @Post('route/provider/:provider')
  @ApiOperation({
    summary: 'Get route using specific provider',
    description: 'Force route calculation using a specific provider (HERE or MAPBOX)',
  })
  @ApiBody({
    description: 'Routing request for specific provider',
    examples: {
      'mapbox-route': {
        summary: 'Force Mapbox routing',
        value: {
          waypoints: [
            { latitude: 37.7749, longitude: -122.4194, name: 'San Francisco' },
            { latitude: 37.7849, longitude: -122.4094, name: 'SF Destination' },
          ],
          options: {
            travelMode: 'DRIVING',
          },
        },
      },
      'here-route': {
        summary: 'Force HERE routing',
        value: {
          waypoints: [
            { latitude: 48.8566, longitude: 2.3522, name: 'Paris' },
            { latitude: 48.8606, longitude: 2.3376, name: 'Louvre' },
            { latitude: 48.8584, longitude: 2.2945, name: 'Eiffel Tower' },
          ],
          options: {
            travelMode: 'WALKING',
          },
        },
      },
    },
  })
  async getRouteWithProvider(
    @Query('provider') provider: 'HERE' | 'MAPBOX',
    @Body() routingRequest: RoutingRequestDto,
  ) {
    return await this.routingService.getRoutingWithProvider(routingRequest, provider);
  }

  @Get('providers/recommended')
  @ApiOperation({
    summary: 'Get recommended provider for waypoint count',
    description: 'Returns the recommended provider based on number of waypoints',
  })
  @ApiQuery({
    name: 'waypointCount',
    description: 'Number of waypoints in the route',
    example: 15,
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended provider information',
    schema: {
      type: 'object',
      properties: {
        waypointCount: { type: 'number', example: 15 },
        recommendedProvider: { type: 'string', enum: ['HERE', 'MAPBOX'], example: 'MAPBOX' },
        canUseMapbox: { type: 'boolean', example: true },
        mapboxLimit: { type: 'number', example: 25 },
      },
    },
  })
  async getRecommendedProvider(
    @Query('waypointCount') waypointCount: number,
  ) {
    const recommendedProvider = this.routingService.getRecommendedProvider(waypointCount);
    const canUseMapbox = this.routingService.canUseMapbox(waypointCount);

    return {
      waypointCount,
      recommendedProvider,
      canUseMapbox,
      mapboxLimit: 25,
    };
  }

  @Get('test/coordinates')
  @ApiOperation({
    summary: 'Get test coordinates for common locations',
    description: 'Returns sample coordinates for testing routing functionality',
  })
  @ApiResponse({
    status: 200,
    description: 'Test coordinates for various locations',
    schema: {
      type: 'object',
      properties: {
        locations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getTestCoordinates() {
    return {
      locations: [
        { name: 'New York City', latitude: 40.7128, longitude: -74.006 },
        { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
        { name: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
        { name: 'London', latitude: 51.5074, longitude: -0.1278 },
        { name: 'Paris', latitude: 48.8566, longitude: 2.3522 },
        { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
        { name: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
        { name: 'San Francisco', latitude: 37.7749, longitude: -122.4194 },
      ],
    };
  }
}

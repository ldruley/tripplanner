import { Body, Controller, Get, Post, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { RoutingRequestDto, RoutingResponseDto } from '@trip-planner/shared/dtos';
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
  @ApiResponse({
    type: RoutingResponseDto,
  })
  async getRoute(@Body() routingRequest: RoutingRequestDto) {
    return await this.routingService.getRouting(routingRequest);
  }

  @Post('route/provider/:provider')
  @ApiOperation({
    summary: 'Get route using specific provider',
    description: 'Force route calculation using a specific provider (HERE or MAPBOX)',
  })
  @ApiParam({
    name: 'provider',
    description: 'Routing provider to use',
    enum: ['HERE', 'MAPBOX'],
  })
  @ApiResponse({
    type: RoutingResponseDto,
  })
  async getRouteWithProvider(
    @Param('provider') provider: 'HERE' | 'MAPBOX',
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
  })
  async getRecommendedProvider(@Query('waypointCount') waypointCount: number) {
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

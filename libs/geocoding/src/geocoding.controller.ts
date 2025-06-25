import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import {
  ForwardGeocodeQuery,
  ForwardGeocodeQueryDto,
  GeocodingResultDto, ReverseGeocodeQuery, ReverseGeocodeQueryDto
} from '../../shared/types/src/schemas/geocoding.schema';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';


@Controller('geocoding') // This will expose endpoints at /geocoding
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @UsePipes(ZodValidationPipe)
  @ApiOperation({ summary: 'Find locations based on a search query (Forward Geocoding)' })
  @ApiQuery({ name: 'search', description: 'The address or place to search for.', type: String, required: true })
  @ApiResponse({
    status: 200,
    description: 'An array of matching locations found by the geocoding provider.',
    type: [GeocodingResultDto],
  })
  @ApiResponse({ status: 400, description: 'Bad Request. The search query is invalid or too short.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @Get('forward')
  async forwardGeocode(@Query() query: ForwardGeocodeQueryDto) {
    return this.geocodingService.forwardGeocode(query as ForwardGeocodeQuery);
  }

  @UsePipes(ZodValidationPipe)
  @ApiOperation({ summary: 'Get location details based on latitude and longitude (Reverse Geocoding)' })
  @ApiQuery({ name: 'latitude', description: 'The latitude of the location.', type: Number, required: true })
  @ApiQuery({ name: 'longitude', description: 'The longitude of the location.', type: Number, required: true })
  @ApiResponse({
    status: 200,
    description: 'Location details for the specified latitude and longitude.',
    type: GeocodingResultDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Latitude and longitude are required.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @Get('reverse')
  async reverseGeocode(@Query() query: ReverseGeocodeQueryDto) {
    return this.geocodingService.reverseGeocode(query as ReverseGeocodeQuery);
  }
}

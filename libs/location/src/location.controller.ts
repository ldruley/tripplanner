import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CreateLocationRequest, Location } from '@trip-planner/types';
import { JwtAuthGuard } from '@trip-planner/auth';
import { LocationService } from './location.service';

@ApiTags('location')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('location')
export class LocationController {
  private readonly logger = new Logger(LocationController.name);
  constructor(private readonly locationService: LocationService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location retrieved successfully',
  })
  async getLocationById(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    this.logger.debug(`Retrieving location with ID: ${id}`);

    return await this.locationService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new location' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Location created successfully',
  })
  async createLocation(@Body() createLocationDto: CreateLocationRequest): Promise<Location> {
    this.logger.debug(`Creating new location: ${JSON.stringify(createLocationDto)}`);

    return await this.locationService.upsert(
      createLocationDto,
      {
        enableApiSourceMatching: true,
        enableExactCoordinateMatching: true
      }
    );
  }
}

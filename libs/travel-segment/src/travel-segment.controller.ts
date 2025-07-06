import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import {
  CreateTravelSegmentDto,
  UpdateTravelSegmentDto,
  UpdateTravelSegmentNotesDto,
  BulkTravelSegmentUpdateDto,
  TravelSegmentSearchDto,
} from '@trip-planner/shared/dtos';
import { TravelSegmentService } from './travel-segment.service';

@ApiTags('travel-segments')
@UseGuards(JwtAuthGuard)
@Controller('travel-segments')
@UsePipes(ZodValidationPipe)
export class TravelSegmentController {
  constructor(private readonly travelSegmentService: TravelSegmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new travel segment',
    description: 'Create a travel segment between two stops in a trip',
  })
  @ApiResponse({
    status: 201,
    description: 'Travel segment created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or segment already exists',
  })
  async createTravelSegment(
    @CurrentUser() user: SafeUser,
    @Body() createDto: CreateTravelSegmentDto,
  ) {
    return await this.travelSegmentService.create(createDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get travel segment by ID',
    description: 'Retrieve a specific travel segment by its ID',
  })
  @ApiParam({ name: 'id', description: 'Travel segment ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segment found',
  })
  @ApiResponse({
    status: 404,
    description: 'Travel segment not found',
  })
  async getTravelSegment(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    return await this.travelSegmentService.findById(id);
  }

  @Get('trip/:tripId')
  @ApiOperation({
    summary: 'Get travel segments by trip ID',
    description: 'Retrieve all travel segments for a specific trip',
  })
  @ApiParam({ name: 'tripId', description: 'Trip ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segments retrieved successfully',
  })
  async getTravelSegmentsByTrip(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    return await this.travelSegmentService.findByTripId(tripId);
  }

  @Get('stops/:originStopId/:destinationStopId')
  @ApiOperation({
    summary: 'Get travel segment by stops',
    description: 'Retrieve travel segment between two specific stops',
  })
  @ApiParam({ name: 'originStopId', description: 'Origin stop ID' })
  @ApiParam({ name: 'destinationStopId', description: 'Destination stop ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segment found',
  })
  @ApiResponse({
    status: 404,
    description: 'Travel segment not found',
  })
  async getTravelSegmentByStops(
    @CurrentUser() user: SafeUser,
    @Param('originStopId') originStopId: string,
    @Param('destinationStopId') destinationStopId: string,
  ) {
    const segment = await this.travelSegmentService.findByStops(originStopId, destinationStopId);
    if (!segment) {
      return null;
    }
    return segment;
  }

  @Post('search')
  @ApiOperation({
    summary: 'Search travel segments',
    description: 'Search for travel segments based on criteria',
  })
  @ApiResponse({
    status: 200,
    description: 'Travel segments found',
  })
  async searchTravelSegments(
    @CurrentUser() user: SafeUser,
    @Body() searchDto: TravelSegmentSearchDto,
  ) {
    return await this.travelSegmentService.search(searchDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update travel segment',
    description: 'Update a travel segment with new data',
  })
  @ApiParam({ name: 'id', description: 'Travel segment ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segment updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Travel segment not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async updateTravelSegment(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() updateDto: UpdateTravelSegmentDto,
  ) {
    return await this.travelSegmentService.update(id, updateDto);
  }

  @Post('bulk-update')
  @ApiOperation({
    summary: 'Bulk update travel segments',
    description: 'Update multiple travel segments for a trip',
  })
  @ApiResponse({
    status: 200,
    description: 'Travel segments updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  async bulkUpdateTravelSegments(
    @CurrentUser() user: SafeUser,
    @Body() bulkUpdateDto: BulkTravelSegmentUpdateDto,
  ) {
    return await this.travelSegmentService.bulkUpdate(bulkUpdateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete travel segment',
    description: 'Delete a travel segment by its ID',
  })
  @ApiParam({ name: 'id', description: 'Travel segment ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segment deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Travel segment not found',
  })
  async deleteTravelSegment(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    await this.travelSegmentService.delete(id);
    return { message: 'Travel segment deleted successfully' };
  }

  @Delete('trip/:tripId')
  @ApiOperation({
    summary: 'Delete all travel segments for a trip',
    description: 'Delete all travel segments associated with a specific trip',
  })
  @ApiParam({ name: 'tripId', description: 'Trip ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segments deleted successfully',
  })
  async deleteTravelSegmentsByTrip(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    await this.travelSegmentService.deleteByTripId(tripId);
    return { message: 'All travel segments for trip deleted successfully' };
  }

  @Delete('stop/:stopId')
  @ApiOperation({
    summary: 'Delete travel segments by stop ID',
    description:
      'Delete all travel segments associated with a specific stop (when stop is deleted)',
  })
  @ApiParam({ name: 'stopId', description: 'Stop ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segments deleted successfully',
  })
  async deleteTravelSegmentsByStop(@CurrentUser() user: SafeUser, @Param('stopId') stopId: string) {
    await this.travelSegmentService.deleteByStopId(stopId);
    return { message: 'Travel segments associated with stop deleted successfully' };
  }

  @Get('trip/:tripId/count')
  @ApiOperation({
    summary: 'Get travel segment count for trip',
    description: 'Get the total number of travel segments for a specific trip',
  })
  @ApiParam({ name: 'tripId', description: 'Trip ID' })
  @ApiResponse({
    status: 200,
    description: 'Travel segment count retrieved successfully',
  })
  async getTravelSegmentCount(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    const count = await this.travelSegmentService.getSegmentCount(tripId);
    return { count };
  }

  @Get(':id/validate')
  @ApiOperation({
    summary: 'Validate travel segment exists',
    description: 'Check if a travel segment exists by its ID',
  })
  @ApiParam({ name: 'id', description: 'Travel segment ID' })
  @ApiResponse({
    status: 200,
    description: 'Validation result returned',
  })
  async validateTravelSegment(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    const exists = await this.travelSegmentService.validateSegmentExists(id);
    return { exists };
  }

  @Get(':segmentId/belongs-to-trip/:tripId')
  @ApiOperation({
    summary: 'Validate travel segment belongs to trip',
    description: 'Check if a travel segment belongs to a specific trip',
  })
  @ApiParam({ name: 'segmentId', description: 'Travel segment ID' })
  @ApiParam({ name: 'tripId', description: 'Trip ID' })
  @ApiResponse({
    status: 200,
    description: 'Validation result returned',
  })
  async validateTravelSegmentBelongsToTrip(
    @CurrentUser() user: SafeUser,
    @Param('segmentId') segmentId: string,
    @Param('tripId') tripId: string,
  ) {
    const belongs = await this.travelSegmentService.validateSegmentBelongsToTrip(segmentId, tripId);
    return { belongs };
  }

  @Post('trip/:tripId/create-between-stops')
  @ApiOperation({
    summary: 'Create segments between consecutive stops',
    description: 'Create travel segments between consecutive stops in a trip (utility endpoint)',
  })
  @ApiParam({ name: 'tripId', description: 'Trip ID' })
  @ApiResponse({
    status: 201,
    description: 'Travel segments created successfully',
  })
  async createSegmentsBetweenStops(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() body: { stopIds: string[] },
  ) {
    return await this.travelSegmentService.createSegmentsBetweenStops(tripId, body.stopIds);
  }
}

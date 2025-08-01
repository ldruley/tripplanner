import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser, TripFindOptions } from '@trip-planner/types';
import {
  CreateTripDto,
  UpdateTripDto,
  TripSearchDto,
  AddParticipantToTripDto,
  UpdateParticipantRoleDto,
  TripParticipantListResponseDto,
  TripParticipantDto
} from '@trip-planner/shared/dtos';
import { TripService } from './trip.service';
import { TripParticipantService } from './trip-participant.service';
import { TripPermissionService } from './trip-permission.service';
import { TripPermission } from '@trip-planner/types';

@UseGuards(JwtAuthGuard)
@Controller('trips')
export class TripController {
  constructor(
    private readonly tripService: TripService,
    private readonly tripParticipantService: TripParticipantService,
    private readonly tripPermissionService: TripPermissionService
  ) {}

  @Post()
  async createTrip(@CurrentUser() user: SafeUser, @Body() createTripDto: CreateTripDto) {
    return await this.tripService.create(user.id, createTripDto);
  }

  @Get(':id')
  async getTrip(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('includeStops') includeStops?: string,
    @Query('includeBankedLocations') includeBankedLocations?: string,
    @Query('includeTravelSegments') includeTravelSegments?: string,
  ) {
    // Check if user has read permission
    await this.tripPermissionService.requirePermission(id, user.id, TripPermission.READ);

    const options: TripFindOptions = {
      includeStops: includeStops === 'true',
      includeBankedLocations: includeBankedLocations === 'true',
      includeTravelSegments: includeTravelSegments === 'true',
    };

    const trip = await this.tripService.findById(id, options);

    return trip;
  }

  @Get()
  async getTrips(
    @CurrentUser() user: SafeUser,
    @Query('includeStops') includeStops?: string,
    @Query('includeBankedLocations') includeBankedLocations?: string,
    @Query('includeTravelSegments') includeTravelSegments?: string,
  ) {
    return await this.tripService.findByUserId(
      user.id,
      includeStops === 'true',
      includeBankedLocations === 'true',
      includeTravelSegments === 'true',
    );
  }

  @Post('search')
  async searchTrips(@CurrentUser() user: SafeUser, @Body() searchDto: TripSearchDto) {
    // Ensure user can only search their own trips
    const criteria = {
      ...searchDto,
      userId: user.id,
    };

    return await this.tripService.search(criteria);
  }

  @Patch(':id')
  async updateTrip(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() updateTripDto: UpdateTripDto,
  ) {
    // Check if user has edit permission
    await this.tripPermissionService.requirePermission(id, user.id, TripPermission.EDIT);

    return await this.tripService.update(id, updateTripDto);
  }

  @Delete(':id')
  async deleteTrip(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    // Check if user has delete permission (only owners can delete)
    await this.tripPermissionService.requirePermission(id, user.id, TripPermission.DELETE);

    await this.tripService.delete(id);
    return { message: 'Trip deleted successfully' };
  }

  @Get('user/count')
  async getTripCount(@CurrentUser() user: SafeUser) {
    const count = await this.tripService.getTripCount(user.id);
    return { count };
  }

  @Get(':id/validate')
  async validateTrip(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    const exists = await this.tripService.validateTripExists(id);
    const hasAccess = exists ? await this.tripPermissionService.hasAccess(id, user.id) : false;

    return {
      exists,
      hasAccess,
    };
  }

  // Participant management endpoints

  @Get(':id/participants')
  @ApiOperation({ summary: 'Get all participants for a trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiResponse({ status: 200, description: 'Participants retrieved successfully', type: TripParticipantListResponseDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  async getParticipants(
    @Param('id') tripId: string,
    @CurrentUser() user: SafeUser
  ) {
    return this.tripParticipantService.getParticipants(tripId, user.id);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Add a participant to a trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: AddParticipantToTripDto })
  @ApiResponse({ status: 201, description: 'Participant added successfully', type: TripParticipantDto })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Trip not found' })
  @ApiResponse({ status: 409, description: 'User is already a participant' })
  async addParticipant(
    @Param('id') tripId: string,
    @Body() dto: AddParticipantToTripDto,
    @CurrentUser() user: SafeUser
  ) {
    return this.tripParticipantService.addParticipant(tripId, dto, user.id);
  }

  @Put(':id/participants/:userId')
  @ApiOperation({ summary: 'Update a participant\'s role' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiParam({ name: 'userId', description: 'User ID of the participant' })
  @ApiBody({ type: UpdateParticipantRoleDto })
  @ApiResponse({ status: 200, description: 'Participant role updated successfully', type: TripParticipantDto })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Trip or participant not found' })
  async updateParticipantRole(
    @Param('id') tripId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateParticipantRoleDto,
    @CurrentUser() user: SafeUser
  ) {
    return this.tripParticipantService.updateParticipantRole(tripId, userId, dto, user.id);
  }

  @Delete(':id/participants/:userId')
  @ApiOperation({ summary: 'Remove a participant from a trip' })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiParam({ name: 'userId', description: 'User ID of the participant' })
  @ApiResponse({ status: 204, description: 'Participant removed successfully' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 404, description: 'Trip or participant not found' })
  @HttpCode(204)
  async removeParticipant(
    @Param('id') tripId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: SafeUser
  ) {
    return this.tripParticipantService.removeParticipant(tripId, userId, user.id);
  }

  @Get('participated')
  @ApiOperation({ summary: 'Get trips the current user participates in' })
  @ApiResponse({ status: 200, description: 'Participated trips retrieved successfully' })
  async getUserParticipatedTrips(@CurrentUser() user: SafeUser) {
    return this.tripParticipantService.getUserParticipatedTrips(user.id);
  }
}

import {
  Controller,
  Post,
  Put,
  Delete,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@trip-planner/auth';
import { CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import { ItineraryService } from './itinerary.service';
import {
  CreateTripFromOrganizedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
  UpdateTripRoutingDto,
  UpdateTripWithRoutingDto,
  AddLocationToBankDto,
  RemoveLocationFromBankDto,
  PromoteLocationToStopDto,
  TripBankedLocationDto,
} from '@trip-planner/shared/dtos';
import { Trip } from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

@ApiTags('itinerary')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('itinerary')
export class ItineraryController {
  private readonly logger = new Logger(ItineraryController.name);

  constructor(private readonly itineraryService: ItineraryService) {}

  @Post('trips')
  @ApiOperation({ summary: 'Create a trip from organized list of locations' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Trip created successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async createTripFromOrganizedList(
    @CurrentUser() user: SafeUser,
    @Body() data: CreateTripFromOrganizedListDto,
  ): Promise<Trip> {
    this.logger.log(`Creating trip from organized list for user ${user.id}`);
    return await this.itineraryService.createTripFromOrganizedList(user.id, data);
  }

  @Post('trips/:tripId/stops')
  @ApiOperation({ summary: 'Add a stop to an existing trip' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Stop added successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async addStopToTrip(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: Omit<AddStopToTripDto, 'tripId'>,
  ): Promise<Trip> {
    this.logger.log(`Adding stop to trip ${tripId} for user ${user.id}`);
    const fullData: AddStopToTripDto = { ...data, tripId };
    return await this.itineraryService.addStopToTrip(user.id, fullData);
  }

  @Delete('trips/:tripId/stops/:stopId')
  @ApiOperation({ summary: 'Remove a stop from a trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stop removed successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip or stop not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async removeStopFromTrip(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Param('stopId') stopId: string,
    @Query('calculateRouting') calculateRouting = true,
    @Query('travelMode') travelMode: TravelMode = TravelMode.DRIVING,
  ): Promise<Trip> {
    this.logger.log(`Removing stop ${stopId} from trip ${tripId} for user ${user.id}`);

    const data: RemoveStopFromTripDto = {
      tripId,
      stopId,
      calculateRouting,
      travelMode,
    };

    return await this.itineraryService.removeStopFromTrip(user.id, data);
  }

  @Put('trips/:tripId/stops/reorder')
  @ApiOperation({ summary: 'Reorder stops in a trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stops reordered successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async reorderStops(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: Omit<ItineraryReorderStopsDto, 'tripId'>,
  ): Promise<Trip> {
    this.logger.log(`Reordering stops in trip ${tripId} for user ${user.id}`);
    const fullData: ItineraryReorderStopsDto = { ...data, tripId };
    return await this.itineraryService.reorderStops(user.id, fullData);
  }

  @Put('trips/:tripId/stops/reorder/batched')
  @ApiOperation({ summary: 'EXPERIMENTAL: Reorder stops using batched database operations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stops reordered successfully using batched operations',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async reorderStopsWithBatching(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: Omit<ItineraryReorderStopsDto, 'tripId'>,
  ): Promise<Trip> {
    this.logger.log(`[EXPERIMENTAL] Reordering stops with batching in trip ${tripId} for user ${user.id}`);
    const fullData: ItineraryReorderStopsDto = { ...data, tripId };
    return await this.itineraryService.reorderStopsWithBatching(user.id, fullData);
  }

  @Put('trips/:tripId')
  @ApiOperation({ summary: 'Update trip details with optional routing recalculation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Trip updated successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async updateTripWithRouting(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: UpdateTripWithRoutingDto,
  ): Promise<Trip> {
    this.logger.log(`Updating trip ${tripId} with routing for user ${user.id}`);
    return await this.itineraryService.updateTripWithRouting(user.id, tripId, data);
  }

  @Put('trips/:tripId/routing')
  @ApiOperation({ summary: 'Update routing for an entire trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Routing updated successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async updateTripRouting(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: Omit<UpdateTripRoutingDto, 'tripId'>,
  ): Promise<Trip> {
    this.logger.log(`Updating routing for trip ${tripId} for user ${user.id}`);
    const fullData: UpdateTripRoutingDto = { ...data, tripId };
    return await this.itineraryService.updateTripRouting(user.id, fullData);
  }

  @Get('trips/:tripId/routing/summary')
  @ApiOperation({ summary: 'Get routing summary for a trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Routing summary retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getTripRoutingSummary(@Param('tripId') tripId: string): Promise<{
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    hasCompleteRouting: boolean;
    segmentCount: number;
  }> {
    this.logger.log(`Getting routing summary for trip ${tripId}`);
    return await this.itineraryService.getTripRoutingSummary(tripId);
  }

  @Get('trips/:tripId/routing/needed')
  @ApiOperation({ summary: 'Check if routing is needed for a trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Routing status retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async isRoutingNeeded(
    @Param('tripId') tripId: string,
    @Query('forceRecalculate') forceRecalculate = false,
  ): Promise<{ routingNeeded: boolean }> {
    this.logger.log(`Checking if routing is needed for trip ${tripId}`);
    const routingNeeded = await this.itineraryService.isRoutingNeeded(tripId, forceRecalculate);
    return { routingNeeded };
  }

  @Post('trips/:tripId/routing/calculate')
  @ApiOperation({ summary: 'Calculate routing for a trip if needed' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Routing calculated successfully or not needed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async calculateRoutingIfNeeded(
    @Param('tripId') tripId: string,
    @Query('travelMode') travelMode: TravelMode = TravelMode.DRIVING,
    @Query('forceRecalculate') forceRecalculate = false,
  ): Promise<{ updated: boolean; trip: Trip | null }> {
    this.logger.log(`Calculating routing if needed for trip ${tripId}`);
    const trip = await this.itineraryService.calculateRoutingIfNeeded(
      tripId,
      travelMode,
      forceRecalculate,
    );
    return { updated: trip !== null, trip };
  }

  @Post('trips/:tripId/bank')
  @ApiOperation({ summary: 'Add a location to trip bank' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Location added to bank successfully',
    type: TripBankedLocationDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async addLocationToBank(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Body() data: AddLocationToBankDto,
  ): Promise<any> {
    this.logger.log(`Adding location ${data.locationId} to bank for trip ${tripId} for user ${user.id}`);
    return await this.itineraryService.addLocationToBank(user.id, tripId, data.locationId);
  }

  @Delete('trips/:tripId/bank/:locationId')
  @ApiOperation({ summary: 'Remove a location from trip bank' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location removed from bank successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip or location not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async removeLocationFromBank(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Param('locationId') locationId: string,
  ): Promise<void> {
    this.logger.log(`Removing location ${locationId} from bank for trip ${tripId} for user ${user.id}`);
    return await this.itineraryService.removeLocationFromBank(user.id, tripId, locationId);
  }

  @Get('trips/:tripId/bank')
  @ApiOperation({ summary: 'Get all banked locations for a trip' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Banked locations retrieved successfully',
    type: [TripBankedLocationDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async getBankedLocations(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
  ): Promise<any[]> {
    this.logger.log(`Getting banked locations for trip ${tripId} for user ${user.id}`);
    return await this.itineraryService.getBankedLocations(user.id, tripId);
  }

  @Post('trips/:tripId/bank/:locationId/promote')
  @ApiOperation({ summary: 'Promote a banked location to a stop' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location promoted to stop successfully',
    type: Object, // Trip type would be defined in OpenAPI
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Trip or location not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized',
  })
  async promoteLocationToStop(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Param('locationId') locationId: string,
    @Body() data: PromoteLocationToStopDto,
  ): Promise<Trip> {
    this.logger.log(`Promoting location ${locationId} to stop for trip ${tripId} for user ${user.id}`);
    return await this.itineraryService.promoteLocationToStop(user.id, tripId, locationId, data.position);
  }
}

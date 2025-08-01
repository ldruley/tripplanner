import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import { UpdateStopDto, StopSearchDto } from '@trip-planner/shared/dtos';
import { StopService } from './stop.service';
import { TripPermissionService, TripPermission } from '@trip-planner/trip';

@UseGuards(JwtAuthGuard)
@Controller('stops')
export class StopController {
  constructor(
    private readonly stopService: StopService,
    private readonly tripPermissionService: TripPermissionService,
  ) {}

  @Get(':id')
  async getStop(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('includeLocation') includeLocation?: string,
  ) {
    const includeLocationFlag = includeLocation === 'true';
    const stop = await this.stopService.findById(id, includeLocationFlag);
    await this.tripPermissionService.requirePermission(stop.tripId, user.id, TripPermission.READ);
    return stop;
  }

  @Get('trip/:tripId')
  async getStopsByTrip(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Query('includeLocations') includeLocations?: string,
  ) {
    const includeLocationsFlag = includeLocations === 'true';
    await this.tripPermissionService.requirePermission(tripId, user.id, TripPermission.READ);
    return await this.stopService.findByTripId(tripId, includeLocationsFlag);
  }

  @Post('search')
  async searchStops(@CurrentUser() user: SafeUser, @Body() searchDto: StopSearchDto) {
    return await this.stopService.search(searchDto);
  }

  @Patch(':id')
  async updateStop(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body() updateStopDto: UpdateStopDto,
  ) {
    const tripId = await this.stopService.getTripId(id);
    await this.tripPermissionService.requirePermission(tripId, user.id, TripPermission.EDIT);
    return await this.stopService.update(id, updateStopDto);
  }

  @Get('trip/:tripId/next-order')
  async getNextOrderForTrip(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    const nextOrder = await this.stopService.getNextOrderForTrip(tripId);
    return { nextOrder };
  }

  @Get('trip/:tripId/count')
  async getStopCount(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    await this.tripPermissionService.requirePermission(tripId, user.id, TripPermission.READ);
    const count = await this.stopService.getStopCount(tripId);
    return { count };
  }

  @Get(':stopId/belongs-to-trip/:tripId')
  async validateStopBelongsToTrip(
    @CurrentUser() user: SafeUser,
    @Param('stopId') stopId: string,
    @Param('tripId') tripId: string,
  ) {
    await this.tripPermissionService.requirePermission(tripId, user.id, TripPermission.READ);
    const belongs = await this.stopService.validateStopBelongsToTrip(stopId, tripId);
    return { belongs };
  }
}

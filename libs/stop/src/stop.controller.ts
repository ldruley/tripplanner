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
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import {
  CreateStopDto,
  UpdateStopDto,
  ReorderStopsDto,
  BulkStopUpdateDto,
  StopSearchDto,
} from '@trip-planner/shared/dtos';
import { StopService } from './stop.service';

@UseGuards(JwtAuthGuard)
@Controller('stops')
@UsePipes(ZodValidationPipe)
export class StopController {
  constructor(private readonly stopService: StopService) {}

  @Get(':id')
  async getStop(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Query('includeLocation') includeLocation?: string,
  ) {
    const includeLocationFlag = includeLocation === 'true';
    return await this.stopService.findById(id, includeLocationFlag);
  }

  @Get('trip/:tripId')
  async getStopsByTrip(
    @CurrentUser() user: SafeUser,
    @Param('tripId') tripId: string,
    @Query('includeLocations') includeLocations?: string,
  ) {
    const includeLocationsFlag = includeLocations === 'true';
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
    return await this.stopService.update(id, updateStopDto);
  }

  @Put(':id/calculated-times')
  async updateCalculatedTimes(
    @CurrentUser() user: SafeUser,
    @Param('id') id: string,
    @Body()
    body: {
      calculatedArrivalTime?: string;
      calculatedDepartureTime?: string;
    },
  ) {
    const arrivalTime = body.calculatedArrivalTime
      ? new Date(body.calculatedArrivalTime)
      : undefined;
    const departureTime = body.calculatedDepartureTime
      ? new Date(body.calculatedDepartureTime)
      : undefined;

    return await this.stopService.updateCalculatedTimes(id, arrivalTime, departureTime);
  }

  @Get('trip/:tripId/next-order')
  async getNextOrderForTrip(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    const nextOrder = await this.stopService.getNextOrderForTrip(tripId);
    return { nextOrder };
  }

  @Get('trip/:tripId/count')
  async getStopCount(@CurrentUser() user: SafeUser, @Param('tripId') tripId: string) {
    const count = await this.stopService.getStopCount(tripId);
    return { count };
  }

  @Get(':id/validate')
  async validateStop(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    const exists = await this.stopService.validateStopExists(id);
    return { exists };
  }

  @Get(':stopId/belongs-to-trip/:tripId')
  async validateStopBelongsToTrip(
    @CurrentUser() user: SafeUser,
    @Param('stopId') stopId: string,
    @Param('tripId') tripId: string,
  ) {
    const belongs = await this.stopService.validateStopBelongsToTrip(stopId, tripId);
    return { belongs };
  }
}

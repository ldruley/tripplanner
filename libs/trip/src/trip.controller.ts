import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import { CreateTripDto, UpdateTripDto, TripSearchDto } from '@trip-planner/shared/dtos';
import { TripService } from './trip.service';

@UseGuards(JwtAuthGuard)
@Controller('trips')
@UsePipes(ZodValidationPipe)
export class TripController {
  constructor(private readonly tripService: TripService) {}

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
  ) {
    const trip = await this.tripService.findById(
      id,
      includeStops === 'true',
      includeBankedLocations === 'true',
    );

    // Ensure user owns the trip
    if (trip.userId !== user.id) {
      throw new UnauthorizedException('Unauthorized access to trip');
    }

    return trip;
  }

  @Get()
  async getTrips(
    @CurrentUser() user: SafeUser,
    @Query('includeStops') includeStops?: string,
    @Query('includeBankedLocations') includeBankedLocations?: string,
  ) {
    return await this.tripService.findByUserId(
      user.id,
      includeStops === 'true',
      includeBankedLocations === 'true',
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
    // Verify user owns the trip
    const belongs = await this.tripService.validateTripBelongsToUser(id, user.id);
    if (!belongs) {
      throw new UnauthorizedException('Unauthorized access to trip');
    }

    return await this.tripService.update(id, updateTripDto);
  }

  @Delete(':id')
  async deleteTrip(@CurrentUser() user: SafeUser, @Param('id') id: string) {
    // Verify user owns the trip
    const belongs = await this.tripService.validateTripBelongsToUser(id, user.id);
    if (!belongs) {
      throw new UnauthorizedException('Unauthorized access to trip');
    }

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
    const belongs = exists ? await this.tripService.validateTripBelongsToUser(id, user.id) : false;

    return {
      exists,
      belongs,
    };
  }
}

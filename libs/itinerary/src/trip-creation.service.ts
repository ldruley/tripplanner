import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { LocationService } from '@trip-planner/location';
import { StopService } from '@trip-planner/stop';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { CreateTripFromOrderedListDto } from '@trip-planner/shared/dtos';
import { TripBankedLocationService } from './tripbankedlocation/trip-banked-location.service';
import {
  Trip,
  CreateTripRequest,
  CreateLocationRequest,
  CreateStopRequest,
} from '@trip-planner/types';
import { LocationCategory } from '@prisma/client';

@Injectable()
export class TripCreationService {
  private readonly logger = new Logger(TripCreationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tripService: TripService,
    private readonly locationService: LocationService,
    private readonly stopService: StopService,
    private readonly travelSegmentService: TravelSegmentService,
    private readonly bankCoordinationService: TripBankedLocationService,
  ) {}

  /**
   * Create a complete trip from an organized list of locations.
   * Handles trip creation, location deduplication, stop creation, and travel segment creation in a single transaction.
   * @param userId - User ID who owns the trip.
   * @param data - Trip data with organized locations.
   * @return The created trip with all stops, locations, and travel segments.
   */
  async createTripFromOrganizedList(
    userId: string,
    data: CreateTripFromOrderedListDto,
  ): Promise<Trip> {
    this.logger.debug(`Creating trip from organized list for user ${userId}`);

    // Validate organized locations have sequential order
    this.validateOrganizedLocations(data.organizedLocations);

    return await this.prismaService.$transaction(async prismaClient => {
      // Step 1: Create the trip
      const tripData: CreateTripRequest = {
        name: data.name,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      };

      const trip = await this.tripService.create(userId, tripData, prismaClient);
      this.logger.debug(`Created trip ${trip.id}`);

      // Step 2: Process locations and create stops
      const stops = [];
      for (const organizedLocation of data.organizedLocations) {
        // Create or find existing location (with deduplication)
        const locationData: CreateLocationRequest = {
          name: organizedLocation.name,
          description: organizedLocation.description,
          address: organizedLocation.address,
          city: organizedLocation.city,
          state: organizedLocation.state,
          country: organizedLocation.country,
          postalCode: organizedLocation.postalCode,
          latitude: organizedLocation.latitude,
          longitude: organizedLocation.longitude,
          apiSource: organizedLocation.apiSource,
          apiSourceId: organizedLocation.apiSourceId,
          category: organizedLocation.category,
          public: false, // Default to false, can be updated later
        };

        const location = await this.locationService.create(
          locationData,
          { enableExactCoordinateMatching: true, enableApiSourceMatching: true },
          prismaClient,
        );
        this.logger.debug(`Created/found location ${location.id} for ${organizedLocation.name}`);

        // Create stop for this location
        const stopData: CreateStopRequest = {
          tripId: trip.id as string,
          locationId: location.id as string,
          order: organizedLocation.order,
          stopType: 'PITSTOP', // Default stop type
          plannedDuration: null, // Will be calculated later
        };

        const stop = await this.stopService.create(stopData, prismaClient);
        stops.push(stop);
        this.logger.debug(`Created stop ${stop.id} at order ${organizedLocation.order}`);
      }

      // Step 3: Create travel segments between consecutive stops
      if (stops.length >= 2) {
        const stopIds = stops.map(stop => stop.id as string);
        await this.travelSegmentService.createSegmentsBetweenStops(
          trip.id as string,
          stopIds,
          prismaClient,
        );
        this.logger.debug(`Created travel segments between ${stops.length} stops`);
      }

      // Step 4: Process banked locations if provided
      if (data.bankedLocations && data.bankedLocations.length > 0) {
        this.logger.debug(`Processing ${data.bankedLocations.length} banked locations`);

        for (const bankedLocation of data.bankedLocations) {
          // Create or find existing location (with deduplication)
          const locationData: CreateLocationRequest = {
            name: bankedLocation.name,
            description: bankedLocation.description,
            address: bankedLocation.address,
            city: bankedLocation.city,
            state: bankedLocation.state,
            country: bankedLocation.country,
            postalCode: bankedLocation.postalCode,
            latitude: bankedLocation.latitude,
            longitude: bankedLocation.longitude,
            apiSource: bankedLocation.apiSource,
            apiSourceId: bankedLocation.apiSourceId,
            category: bankedLocation.category,
            public: false,
          };

          const location = await this.locationService.create(
            locationData,
            { enableExactCoordinateMatching: true, enableApiSourceMatching: true },
            prismaClient,
          );

          // Add location to bank
          await this.bankCoordinationService.addLocationToBank(
            userId,
            trip.id as string,
            location.id as string,
            prismaClient,
          );

          this.logger.debug(`Added location ${location.id} to bank for ${bankedLocation.name}`);
        }
      }

      // Step 5: Return the complete trip with all details
      const completeTrip = await this.tripService.findById(
        trip.id as string,
        true,
        true,
        true,
        prismaClient,
      );

      this.logger.log(`Successfully created trip ${trip.id} with ${stops.length} stops`);
      return completeTrip;
    });
  }

  /**
   * Validate that organized locations have proper sequential ordering.
   * @param organizedLocations - List of organized locations to validate.
   */
  private validateOrganizedLocations(
    organizedLocations: {
      order: number;
      name: string;
      latitude: number;
      longitude: number;
    }[],
  ): void {
    if (organizedLocations.length === 0) {
      throw new BadRequestException('At least one location is required');
    }

    // Check for duplicate orders
    const orders = organizedLocations.map(loc => loc.order);
    const uniqueOrders = [...new Set(orders)];

    if (orders.length !== uniqueOrders.length) {
      throw new BadRequestException('Duplicate order values found in organized locations');
    }

    // Check for sequential ordering starting from 0
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);

    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i) {
        throw new BadRequestException(
          `Invalid ordering: expected order ${i} but found ${sortedOrders[i]}. Orders must be sequential starting from 0.`,
        );
      }
    }

    // Validate required fields
    for (const location of organizedLocations) {
      if (!location.name || location.name.trim() === '') {
        throw new BadRequestException('All locations must have a name');
      }

      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new BadRequestException('All locations must have valid coordinates');
      }

      if (location.latitude < -90 || location.latitude > 90) {
        throw new BadRequestException('Latitude must be between -90 and 90');
      }

      if (location.longitude < -180 || location.longitude > 180) {
        throw new BadRequestException('Longitude must be between -180 and 180');
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripRepository, TripService } from '@trip-planner/trip';
import { RoutingService } from '@trip-planner/routing';
import { TravelSegmentService } from '@trip-planner/travel-segment';
import { UpdateTripRoutingDto } from '@trip-planner/shared/dtos';
import {
  RoutingRequestSchema,
  RoutingResponse,
  Trip,
  RouteLeg,
  Stop,
  CreatedLocationMap,
  SegmentRoutingData,
} from '@trip-planner/types';
import { TravelMode } from '@prisma/client';

@Injectable()
export class RoutingCoordinationService {
  private readonly logger = new Logger(RoutingCoordinationService.name);

  constructor(
    private readonly tripRepository: TripRepository,
    private readonly tripService: TripService,
    private readonly routingService: RoutingService,
    private readonly travelSegmentService: TravelSegmentService,
  ) {}

  /**
   * Calculate and update routing for an entire trip.
   * Handles multi-provider routing with quota management and fallback.
   * @param data - Trip routing update data.
   * @param prismaClient - Prisma client for transaction.
   * @return The updated trip with routing information.
   */
  async updateTripRouting(
    data: UpdateTripRoutingDto,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Trip> {
    this.logger.debug(`Updating routing for trip ${data.tripId} with mode ${data.travelMode}`);

    // Get trip with all stops and travel segments
    const trip = await this.tripRepository.findTripWithFullDetails(data.tripId, prismaClient);

    if (!trip) {
      throw new Error(`Trip ${data.tripId} not found`);
    }

    if (!trip.stops || trip.stops.length < 2) {
      this.logger.warn(`Trip ${data.tripId} has less than 2 stops, skipping routing`);
      return trip;
    }

    // Extract waypoints from stops
    const waypoints = trip.stops
      .sort((a, b) => a.order - b.order)
      .map(stop => ({
        latitude: stop.location?.latitude,
        longitude: stop.location?.longitude,
        name: stop.location?.name,
      }));

    try {
      // Calculate routing using the routing service
      const routingRequest = RoutingRequestSchema.parse({
        waypoints,
        options: {
          travelMode: data.travelMode,
        },
      });
      const routingResult = await this.routingService.getRouting(routingRequest);

      this.logger.debug(`Received routing result from ${routingResult.provider}`);

      // Update travel segments with routing data
      await this.updateTravelSegmentsWithRouting(
        data.tripId,
        routingResult,
        data.travelMode,
        prismaClient,
      );

      // Clear the routing dirty flag after successful routing
      await this.tripService.updateRoutingRecalculationFlag(data.tripId, false, prismaClient);

      // Get the updated trip with routing data
      const updatedTrip = await this.tripRepository.findTripWithFullDetails(
        data.tripId,
        prismaClient,
      );

      this.logger.log(`Successfully updated routing for trip ${data.tripId}`);
      return updatedTrip as Trip;
    } catch (error) {
      this.logger.error(`Failed to update routing for trip ${data.tripId}:`, error);
      throw error;
    }
  }

  /**
   * TODO: Move this method to a more appropriate service for potential reuse.
   * Calculate routing data for all consecutive stop pairs.
   * Makes external API calls to routing service for all segments.
   * @param stops - Created stops in order.
   * @param createdLocations - Map of created locations.
   * @param travelMode - Travel mode for routing.
   * @return Routing data for all segments.
   */
  async calculateRoutingForAllSegments(
    stops: Stop[],
    createdLocations: CreatedLocationMap,
    travelMode: TravelMode,
  ): Promise<SegmentRoutingData[]> {
    if (stops.length < 2) {
      return [];
    }

    const routingUpdates: SegmentRoutingData[] = [];

    // Sort stops by order to ensure correct sequence
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originStop = sortedStops[i];
      const destinationStop = sortedStops[i + 1];

      // Find the location data for routing
      const originLocation = Object.values(createdLocations).find(
        loc => loc.id === originStop.locationId,
      );
      const destinationLocation = Object.values(createdLocations).find(
        loc => loc.id === destinationStop.locationId,
      );

      if (!originLocation || !destinationLocation) {
        this.logger.warn(
          `Missing location data for segment ${originStop.id}-${destinationStop.id}`,
        );
        continue;
      }

      try {
        // Create waypoints for routing request
        const waypoints = [
          {
            latitude: originLocation.latitude,
            longitude: originLocation.longitude,
            name: originLocation.name,
          },
          {
            latitude: destinationLocation.latitude,
            longitude: destinationLocation.longitude,
            name: destinationLocation.name,
          },
        ];

        // Make actual routing service call
        const routingRequest = RoutingRequestSchema.parse({
          waypoints,
          options: {
            travelMode,
          },
        });

        const routingResult: RoutingResponse = await this.routingService.getRouting(routingRequest);

        this.logger.debug(
          `Pre-calculated routing for segment ${originStop.id}-${destinationStop.id} using ${routingResult.provider}: ${routingResult.route.distance}m, ${routingResult.route.duration}s`,
        );

        // Map routing result to segment creation format
        const routingData: SegmentRoutingData = {
          originStopId: originStop.id as string,
          destinationStopId: destinationStop.id as string,
          travelMode: travelMode,
          apiCalculatedDistance: routingResult.route.distance,
          apiCalculatedDuration: Math.round(routingResult.route.duration / 60), // Convert seconds to minutes
          polyline: routingResult.route.geometry,
        };

        routingUpdates.push(routingData);
      } catch (error) {
        this.logger.error(
          `Failed to calculate routing for segment ${originStop.id}-${destinationStop.id}: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Fallback: create segment without routing data
        const routingData: SegmentRoutingData = {
          originStopId: originStop.id as string,
          destinationStopId: destinationStop.id as string,
          travelMode: travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        };

        routingUpdates.push(routingData);
      }
    }

    return routingUpdates;
  }

  /**
   * Calculate routing for a specific segment between two stops.
   * @param originStopId - Origin stop ID.
   * @param destinationStopId - Destination stop ID.
   * @param travelMode - Travel mode for routing.
   * @param prismaClient - Prisma client for transaction.
   * @return Routing result for the segment.
   */
  async calculateSegmentRouting(
    originStopId: string,
    destinationStopId: string,
    travelMode: TravelMode,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<unknown> {
    this.logger.debug(`Calculating routing from stop ${originStopId} to ${destinationStopId}`);

    // Get the travel segment
    const segment = await this.travelSegmentService.findByStops(
      originStopId,
      destinationStopId,
      prismaClient,
    );

    if (!segment) {
      throw new Error(
        `Travel segment not found between stops ${originStopId} and ${destinationStopId}`,
      );
    }

    // Get stop locations
    const originLocation = segment.originStop.location;
    const destinationLocation = segment.destinationStop.location;

    const waypoints = [
      {
        latitude: originLocation.latitude,
        longitude: originLocation.longitude,
        name: originLocation.name,
      },
      {
        latitude: destinationLocation.latitude,
        longitude: destinationLocation.longitude,
        name: destinationLocation.name,
      },
    ];

    try {
      const routingRequest = RoutingRequestSchema.parse({
        waypoints,
        options: {
          travelMode,
        },
      });
      const routingResult = await this.routingService.getRouting(routingRequest);

      this.logger.debug(`Calculated routing for segment ${segment.id}`);
      return routingResult;
    } catch (error) {
      this.logger.error(`Failed to calculate routing for segment ${segment.id}:`, error);
      throw error;
    }
  }

  /**
   * Update travel segments with routing data.
   * @param tripId - Trip ID.
   * @param routingResult - Routing result from the routing service.
   * @param travelMode - Travel mode used for routing.
   * @param prismaClient - Prisma client for transaction.
   */
  private async updateTravelSegmentsWithRouting(
    tripId: string,
    routingResult: RoutingResponse,
    travelMode: TravelMode,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    // Get all travel segments for the trip
    const segments = await this.travelSegmentService.findByTripId(tripId, prismaClient);

    if (!segments || segments.length === 0) {
      this.logger.warn(`No travel segments found for trip ${tripId}`);
      return;
    }

    // The routing result contains a single route with legs that correspond to segments
    const route = routingResult.route;

    if (!route) {
      this.logger.warn(`No route found in routing result for trip ${tripId}`);
      return;
    }

    const legs = route.legs;

    if (legs.length !== segments.length) {
      this.logger.warn(
        `Route legs count (${legs.length}) does not match segments count (${segments.length}) for trip ${tripId}`,
      );
      return;
    }

    // Update each segment with corresponding leg data
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const leg: RouteLeg = legs[i];

      try {
        // Create properly typed routing data
        const routingData = {
          travelMode,
          distanceMeters: leg.distance,
          durationSeconds: leg.duration,
          polyline: leg.geometry, // Each leg has its own geometry/polyline
          provider: routingResult.provider,
        };

        await this.travelSegmentService.updateWithRoutingData(
          segment.id,
          routingData,
          prismaClient,
        );

        this.logger.debug(`Updated segment ${segment.id} with routing data`);
      } catch (error) {
        this.logger.error(`Failed to update segment ${segment.id} with routing data:`, error);
        // Continue with other segments even if one fails
      }
    }
  }

  /**
   * Validate if routing is needed for a trip.
   * @param tripId - Trip ID to check.
   * @param forceRecalculate - Whether to force recalculation.
   * @param prismaClient - Prisma client for transaction.
   * @return True if routing is needed, false otherwise.
   */
  async isRoutingNeeded(
    tripId: string,
    forceRecalculate = false,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<boolean> {
    if (forceRecalculate) {
      return true;
    }

    // Get trip with travel segments
    const trip = await this.tripRepository.findTripForItineraryUpdate(tripId, prismaClient);

    if (!trip || !trip.stops || trip.stops.length < 2) {
      return false;
    }

    // Check dirty flag first - if set, routing is needed
    if (trip.needsRoutingRecalculation) {
      return true;
    }

    // Fallback: Check if any travel segments are missing routing data
    const segments = trip.travelSegments || [];

    for (const segment of segments) {
      if (!segment.apiCalculatedDistance || !segment.apiCalculatedDuration) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get routing summary for a trip.
   * @param tripId - Trip ID.
   * @param prismaClient - Prisma client for transaction.
   * @return Routing summary with total distance and duration.
   */
  async getTripRoutingSummary(
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<{
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    hasCompleteRouting: boolean;
    segmentCount: number;
  }> {
    const trip = await this.tripRepository.findTripForItineraryUpdate(tripId, prismaClient);

    if (!trip || !trip.travelSegments) {
      return {
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        hasCompleteRouting: false,
        segmentCount: 0,
      };
    }

    let totalDistance = 0;
    let totalDuration = 0;
    let hasCompleteRouting = true;

    for (const segment of trip.travelSegments) {
      if (segment.apiCalculatedDistance && segment.apiCalculatedDuration) {
        totalDistance += segment.apiCalculatedDistance;
        totalDuration += segment.apiCalculatedDuration * 60; // Convert minutes to seconds
      } else {
        hasCompleteRouting = false;
      }
    }

    return {
      totalDistanceMeters: totalDistance,
      totalDurationSeconds: totalDuration,
      hasCompleteRouting,
      segmentCount: trip.travelSegments.length,
    };
  }

  /**
   * Calculate routing updates for specific segment pairs.
   * Makes actual routing service calls to get distance, duration, and polyline data.
   * Consolidates routing calculation logic from StopCoordinationService.
   * @param segmentPairs - Segment pairs that need routing.
   * @param trip - Full trip with stops and locations.
   * @param travelMode - Travel mode for routing.
   * @return Routing data for segments.
   */
  async calculateRoutingForSegmentPairs(
    segmentPairs: Array<{ originStopId: string; destinationStopId: string; tripId: string }>,
    trip: Trip,
    travelMode: TravelMode,
  ): Promise<
    Array<{ originStopId: string; destinationStopId: string; routingData: SegmentRoutingData }>
  > {
    if (segmentPairs.length === 0) {
      return [];
    }

    const routingUpdates: Array<{
      originStopId: string;
      destinationStopId: string;
      routingData: SegmentRoutingData;
    }> = [];

    for (const segmentPair of segmentPairs) {
      const originStop = trip.stops?.find(stop => stop.id === segmentPair.originStopId);
      const destinationStop = trip.stops?.find(stop => stop.id === segmentPair.destinationStopId);

      if (!originStop?.location || !destinationStop?.location) {
        this.logger.warn(
          `Missing location data for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}`,
        );
        continue;
      }

      try {
        // Create waypoints for routing request
        const waypoints = [
          {
            latitude: originStop.location.latitude,
            longitude: originStop.location.longitude,
            name: originStop.location.name,
          },
          {
            latitude: destinationStop.location.latitude,
            longitude: destinationStop.location.longitude,
            name: destinationStop.location.name,
          },
        ];

        // Make actual routing service call
        const routingRequest = RoutingRequestSchema.parse({
          waypoints,
          options: {
            travelMode,
          },
        });

        const routingResult: RoutingResponse = await this.routingService.getRouting(routingRequest);

        this.logger.debug(
          `Calculated routing for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId} using ${routingResult.provider}: ${routingResult.route.distance}m, ${routingResult.route.duration}s`,
        );

        // Map routing result to segment creation format
        const routingData = {
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode: travelMode,
          apiCalculatedDistance: routingResult.route.distance,
          apiCalculatedDuration: Math.round(routingResult.route.duration / 60), // Convert seconds to minutes
          polyline: routingResult.route.geometry,
        };

        routingUpdates.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          routingData,
        });
      } catch (error) {
        this.logger.error(
          `Failed to calculate routing for segment ${segmentPair.originStopId}-${segmentPair.destinationStopId}: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Fallback: create segment without routing data
        const routingData = {
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          travelMode: travelMode,
          apiCalculatedDistance: null,
          apiCalculatedDuration: null,
          polyline: null,
        };

        routingUpdates.push({
          originStopId: segmentPair.originStopId,
          destinationStopId: segmentPair.destinationStopId,
          routingData,
        });
      }
    }

    return routingUpdates;
  }

  /**
   * Create waypoints for routing request from stop locations.
   * Utility method to standardize waypoint creation across routing operations.
   * @param originStop - Origin stop with location data.
   * @param destinationStop - Destination stop with location data.
   * @return Array of waypoints for routing.
   */
  createWaypointsFromStops(originStop: any, destinationStop: any) {
    return [
      {
        latitude: originStop.location.latitude,
        longitude: originStop.location.longitude,
        name: originStop.location.name,
      },
      {
        latitude: destinationStop.location.latitude,
        longitude: destinationStop.location.longitude,
        name: destinationStop.location.name,
      },
    ];
  }
}

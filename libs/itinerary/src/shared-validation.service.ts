import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripService } from '@trip-planner/trip';
import { StopService } from '@trip-planner/stop';
import { LocationService } from '@trip-planner/location';
import { Trip, Stop, Location, CoordinateMatrix } from '@trip-planner/types';

export interface TripValidationResult {
  trip: Trip;
  isValid: boolean;
  errors: string[];
}

export interface StopValidationResult {
  stops: Stop[];
  isValid: boolean;
  errors: string[];
}

export interface LocationValidationResult {
  location: Location | null;
  isValid: boolean;
  errors: string[];
}

export interface MatrixValidationResult {
  isValid: boolean;
  missingCoordinates: string[];
  errors: string[];
}

@Injectable()
export class SharedValidationService {
  private readonly logger = new Logger(SharedValidationService.name);

  constructor(
    private readonly tripService: TripService,
    private readonly stopService: StopService,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Validate trip ownership and existence with comprehensive error details.
   * Consolidates the most common validation pattern across all batch operations.
   */
  async validateTripOwnership(
    tripId: string,
    userId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<TripValidationResult> {
    const errors: string[] = [];

    try {
      const tripBelongsToUser = await this.tripService.validateTripBelongsToUser(
        tripId,
        userId,
        prismaClient,
      );

      if (!tripBelongsToUser) {
        errors.push(`Trip ${tripId} not found or not owned by user ${userId}`);
        return {
          trip: null as any,
          isValid: false,
          errors,
        };
      }

      const trip = await this.tripService.findById(tripId, true, true, true, prismaClient);
      if (!trip) {
        errors.push(`Trip ${tripId} not found`);
        return {
          trip: null as any,
          isValid: false,
          errors,
        };
      }

      return {
        trip,
        isValid: true,
        errors: [],
      };
    } catch (error) {
      errors.push(`Error validating trip ownership: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        trip: null as any,
        isValid: false,
        errors,
      };
    }
  }

  /**
   * Validate location existence and accessibility.
   * Used across add stop and create trip operations.
   */
  async validateLocationExists(
    locationId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<LocationValidationResult> {
    const errors: string[] = [];

    try {
      const location = await this.locationService.findById(locationId, prismaClient);
      if (!location) {
        errors.push(`Location ${locationId} not found`);
        return {
          location: null,
          isValid: false,
          errors,
        };
      }

      // Additional validation can be added here (e.g., location accessibility, completeness)
      if (!location.latitude || !location.longitude) {
        errors.push(`Location ${locationId} missing required coordinates`);
        return {
          location,
          isValid: false,
          errors,
        };
      }

      return {
        location,
        isValid: true,
        errors: [],
      };
    } catch (error) {
      errors.push(`Error validating location: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        location: null,
        isValid: false,
        errors,
      };
    }
  }

  /**
   * Validate stop existence and trip membership.
   * Used in reorder and remove stop operations.
   */
  async validateStopsForTrip(
    stopIds: string[],
    tripId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<StopValidationResult> {
    const errors: string[] = [];

    if (stopIds.length === 0) {
      errors.push('Stop IDs array cannot be empty');
      return {
        stops: [],
        isValid: false,
        errors,
      };
    }

    try {
      // Get all stops for the trip
      const tripStops = await this.stopService.findByTripId(tripId, false, prismaClient);
      const tripStopIds = tripStops.map(stop => stop.id);

      // Check if all provided IDs exist and belong to the trip
      const invalidIds = stopIds.filter(id => !tripStopIds.includes(id));
      if (invalidIds.length > 0) {
        errors.push(`Invalid stop IDs for trip ${tripId}: ${invalidIds.join(', ')}`);
      }

      // For reorder operations, ensure all trip stops are included
      if (stopIds.length !== tripStops.length && errors.length === 0) {
        const missingIds = tripStopIds.filter(id => !stopIds.includes(id));
        if (missingIds.length > 0) {
          errors.push(`Missing stop IDs in reorder operation: ${missingIds.join(', ')}`);
        }
      }

      return {
        stops: tripStops,
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      errors.push(`Error validating stops: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        stops: [],
        isValid: false,
        errors,
      };
    }
  }

  /**
   * Validate matrix data completeness for timeline calculations.
   * Ensures all required coordinate pairs are present.
   */
  validateMatrixCompleteness(
    matrix: CoordinateMatrix,
    stops: Stop[],
  ): MatrixValidationResult {
    const errors: string[] = [];
    const missingCoordinates: string[] = [];

    if (stops.length < 2) {
      return {
        isValid: true,
        missingCoordinates: [],
        errors: [],
      };
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    // Check for consecutive pairs
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const originStop = sortedStops[i];
      const destinationStop = sortedStops[i + 1];
      
      if (!originStop.location || !destinationStop.location) {
        errors.push(`Stop ${originStop.id} or ${destinationStop.id} missing location data`);
        continue;
      }

      const originKey = `${originStop.location.latitude},${originStop.location.longitude}`;
      const destinationKey = `${destinationStop.location.latitude},${destinationStop.location.longitude}`;

      if (!matrix[originKey] || !matrix[originKey][destinationKey]) {
        missingCoordinates.push(`${originKey} -> ${destinationKey}`);
      }
    }

    if (missingCoordinates.length > 0) {
      errors.push(`Missing matrix data for ${missingCoordinates.length} coordinate pairs`);
    }

    return {
      isValid: errors.length === 0,
      missingCoordinates,
      errors,
    };
  }

  /**
   * Validate order values for stop reordering operations.
   * Ensures no duplicate orders and proper sequence.
   */
  validateStopOrders(orderChanges: { stopId: string; newOrder: number }[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (orderChanges.length === 0) {
      return { isValid: true, errors: [] };
    }

    // Check for negative orders
    const negativeOrders = orderChanges.filter(change => change.newOrder < 0);
    if (negativeOrders.length > 0) {
      errors.push(`Negative order values not allowed: ${negativeOrders.map(o => o.newOrder).join(', ')}`);
    }

    // Check for duplicate orders
    const orders = orderChanges.map(change => change.newOrder);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      errors.push('Duplicate order values detected in reordering operation');
    }

    // Check for duplicate stop IDs
    const stopIds = orderChanges.map(change => change.stopId);
    const uniqueStopIds = new Set(stopIds);
    if (stopIds.length !== uniqueStopIds.size) {
      errors.push('Duplicate stop IDs detected in reordering operation');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Comprehensive validation for batch operations.
   * Combines multiple validation checks with detailed error reporting.
   */
  async validateBatchOperation(params: {
    tripId: string;
    userId: string;
    stopIds?: string[];
    locationIds?: string[];
    orderChanges?: { stopId: string; newOrder: number }[];
    matrix?: CoordinateMatrix;
    prismaClient?: PrismaClientOrTransaction;
  }): Promise<{
    isValid: boolean;
    errors: string[];
    trip?: Trip;
    stops?: Stop[];
    locations?: Location[];
  }> {
    const { tripId, userId, stopIds, locationIds, orderChanges, matrix, prismaClient } = params;
    const allErrors: string[] = [];
    let trip: Trip | undefined;
    let stops: Stop[] | undefined;
    let locations: Location[] | undefined;

    // Validate trip ownership
    const tripValidation = await this.validateTripOwnership(tripId, userId, prismaClient);
    if (!tripValidation.isValid) {
      allErrors.push(...tripValidation.errors);
      return { isValid: false, errors: allErrors };
    }
    trip = tripValidation.trip;

    // Validate stops if provided
    if (stopIds && stopIds.length > 0) {
      const stopValidation = await this.validateStopsForTrip(stopIds, tripId, prismaClient);
      if (!stopValidation.isValid) {
        allErrors.push(...stopValidation.errors);
      }
      stops = stopValidation.stops;
    }

    // Validate locations if provided
    if (locationIds && locationIds.length > 0) {
      const locationPromises = locationIds.map(id => this.validateLocationExists(id, prismaClient));
      const locationValidations = await Promise.all(locationPromises);
      
      for (const validation of locationValidations) {
        if (!validation.isValid) {
          allErrors.push(...validation.errors);
        }
      }
      locations = locationValidations.map(v => v.location).filter(Boolean) as Location[];
    }

    // Validate order changes if provided
    if (orderChanges && orderChanges.length > 0) {
      const orderValidation = this.validateStopOrders(orderChanges);
      if (!orderValidation.isValid) {
        allErrors.push(...orderValidation.errors);
      }
    }

    // Validate matrix if provided
    if (matrix && trip?.stops) {
      const matrixValidation = this.validateMatrixCompleteness(matrix, trip.stops);
      if (!matrixValidation.isValid) {
        allErrors.push(...matrixValidation.errors);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      trip,
      stops,
      locations,
    };
  }

  /**
   * Validate organized locations array for trip creation.
   * Ensures all locations have required fields and valid structure.
   */
  validateOrganizedLocations(organizedLocations: any[]): void {
    if (!organizedLocations || !Array.isArray(organizedLocations)) {
      throw new BadRequestException('Organized locations must be a non-empty array');
    }

    if (organizedLocations.length === 0) {
      throw new BadRequestException('At least one location is required for trip creation');
    }

    for (let i = 0; i < organizedLocations.length; i++) {
      const location = organizedLocations[i];
      if (!location) {
        throw new BadRequestException(`Location at index ${i} is null or undefined`);
      }

      if (typeof location.id !== 'string' || location.id.trim().length === 0) {
        throw new BadRequestException(`Location at index ${i} must have a valid ID`);
      }

      if (typeof location.name !== 'string' || location.name.trim().length === 0) {
        throw new BadRequestException(`Location at index ${i} must have a valid name`);
      }

      if (typeof location.latitude !== 'number' || isNaN(location.latitude)) {
        throw new BadRequestException(`Location at index ${i} must have a valid latitude`);
      }

      if (typeof location.longitude !== 'number' || isNaN(location.longitude)) {
        throw new BadRequestException(`Location at index ${i} must have a valid longitude`);
      }

      // Validate latitude/longitude ranges
      if (location.latitude < -90 || location.latitude > 90) {
        throw new BadRequestException(`Location at index ${i} has invalid latitude (must be between -90 and 90)`);
      }

      if (location.longitude < -180 || location.longitude > 180) {
        throw new BadRequestException(`Location at index ${i} has invalid longitude (must be between -180 and 180)`);
      }
    }

    this.logger.debug(`Validated ${organizedLocations.length} organized locations for trip creation`);
  }
}
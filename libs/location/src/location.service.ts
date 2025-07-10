import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  CreateLocationRequest,
  CreateLocationRequestSchema,
  Location,
  LocationSearchCriteria,
  LocationSearchCriteriaSchema,
  UpdateLocationRequest,
  UpdateLocationRequestSchema,
  TimezoneRequest,
  TimezoneResponse,
} from '@trip-planner/types';
import { PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TimezoneService } from '@trip-planner/timezone';
import { LocationRepository } from './location.repository';
import {
  LocationDeduplicationOptions,
  LocationDuplicateCheck,
  DEFAULT_DEDUPLICATION_OPTIONS,
} from './location.types';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly timezoneService: TimezoneService,
  ) {}

  /**
   * Create a new location with deduplication
   * @param data - Location data to create
   * @param options - LocationDeduplicationOptions
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location>
   */
  async create(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions = {},
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    CreateLocationRequestSchema.parse(data);

    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };

    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(data, deduplicationOptions, prismaClient);

    if (duplicateCheck.isDuplicate && duplicateCheck.existingLocation) {
      this.logger.debug(`Duplicate location found: ${duplicateCheck.matchReason}`);
      return duplicateCheck.existingLocation;
    }

    return await this.locationRepository.create(data, prismaClient);
  }

  /**
   * Create or update location (upsert with deduplication)
   * @param data - Location data to create or update
   * @param options - LocationDeduplicationOptions
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location>
   */
  async upsert(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions = {},
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    CreateLocationRequestSchema.parse(data);
    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };

    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(data, deduplicationOptions, prismaClient);

    if (duplicateCheck.isDuplicate && duplicateCheck.existingLocation) {
      this.logger.debug(`Updating existing location: ${duplicateCheck.existingLocation.id}`);

      // Update existing location only with missing information
      const updateData: UpdateLocationRequest = {};

      // Only update fields that are missing in existing location
      if (!duplicateCheck.existingLocation.description && data.description) {
        updateData.description = data.description;
      }
      if (!duplicateCheck.existingLocation.address && data.address) {
        updateData.address = data.address;
      }
      if (!duplicateCheck.existingLocation.city && data.city) {
        updateData.city = data.city;
      }
      if (!duplicateCheck.existingLocation.state && data.state) {
        updateData.state = data.state;
      }
      if (!duplicateCheck.existingLocation.country && data.country) {
        updateData.country = data.country;
      }
      if (!duplicateCheck.existingLocation.postalCode && data.postalCode) {
        updateData.postalCode = data.postalCode;
      }
      if (!duplicateCheck.existingLocation.apiSource && data.apiSource) {
        updateData.apiSource = data.apiSource;
      }
      if (!duplicateCheck.existingLocation.apiSourceId && data.apiSourceId) {
        updateData.apiSourceId = data.apiSourceId;
      }
      if (!duplicateCheck.existingLocation.category && data.category) {
        updateData.category = data.category;
      }

      if (!duplicateCheck.existingLocation.timezone && data.timezone) {
        updateData.timezone = data.timezone;
      }

      if (!duplicateCheck.existingLocation.timezone && !data.timezone) {
        const timezone = await this.timezoneService.getTimezoneByCoordinates({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        updateData.timezone = timezone.timezone;
      }

      // Only update if we have changes to make
      if (Object.keys(updateData).length > 0) {
        return await this.locationRepository.update(
          duplicateCheck.existingLocation.id,
          updateData,
          prismaClient,
        );
      }

      // No changes needed, return existing location
      return duplicateCheck.existingLocation;
    }

    // If timezone is missing, fetch it based on coordinates
    if (!data.timezone) {
      const timezone = await this.timezoneService.getTimezoneByCoordinates({
        latitude: data.latitude,
        longitude: data.longitude,
      });
      data.timezone = timezone.timezone;
    }

    return await this.locationRepository.create(data, prismaClient);
  }

  /**
   * Find location by ID
   * @param id - Location ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location>
   */
  async findById(id: string, prismaClient?: PrismaClientOrTransaction): Promise<Location> {
    const location = await this.locationRepository.findById(id, prismaClient);

    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return location;
  }

  /**
   * Search locations by criteria
   * @param criteria - LocationSearchCriteria
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location[]>
   */
  async search(
    criteria: LocationSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    LocationSearchCriteriaSchema.parse(criteria);
    return await this.locationRepository.search(criteria, prismaClient);
  }

  /**
   * Find locations near coordinates
   * @param latitude - Latitude of the center point
   * @param longitude - Longitude of the center point
   * @param radiusMeters - Search radius in meters (default: 1000)
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location[]>
   */
  async findNearby(
    latitude: number,
    longitude: number,
    radiusMeters = 1000,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    return await this.locationRepository.findByCoordinates(
      latitude,
      longitude,
      radiusMeters,
      prismaClient,
    );
  }

  /**
   * Update location by ID
   * @param id - Location ID
   * @param data - Update data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Updated Location
   */
  async update(
    id: string,
    data: UpdateLocationRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    UpdateLocationRequestSchema.parse(data);
    // Verify location exists
    await this.findById(id, prismaClient);

    return await this.locationRepository.update(id, data, prismaClient);
  }

  /**
   * Update timezone for a location using its coordinates
   * @param locationId - Location ID
   * @param coordinates - Latitude and longitude coordinates
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Updated Location with timezone
   */
  async updateTimezone(
    locationId: string,
    coordinates: { latitude: number; longitude: number },
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    this.logger.debug(
      `Updating timezone for location ${locationId} with coordinates ${coordinates.latitude}, ${coordinates.longitude}`,
    );

    // Verify location exists
    await this.findById(locationId, prismaClient);

    // Get timezone from coordinates
    const timezoneRequest: TimezoneRequest = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };

    try {
      const timezoneResponse: TimezoneResponse =
        await this.timezoneService.getTimezoneByCoordinates(timezoneRequest);

      // Update location with timezone
      const updateData: UpdateLocationRequest = {
        timezone: timezoneResponse.timezone,
      };

      this.logger.debug(`Found timezone ${timezoneResponse.timezone} for location ${locationId}`);

      return await this.locationRepository.update(locationId, updateData, prismaClient);
    } catch (error) {
      this.logger.error(`Failed to update timezone for location ${locationId}:`, error);
      throw error;
    }
  }

  /**
   * Delete location by ID
   * @param id - Location ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<void>
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    // Verify location exists
    await this.findById(id, prismaClient);

    await this.locationRepository.delete(id, prismaClient);
  }

  /**
   * Get all locations
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<Location[]>
   */
  async findAll(prismaClient?: PrismaClientOrTransaction): Promise<Location[]> {
    return await this.locationRepository.findAll(prismaClient);
  }

  /**
   * Check for duplicate locations using simplified strategy - in the future this can be extended
   * 1. Exact coordinates match
   * 2. API source + API source ID match
   * @param data - Location data to check
   * @param options - LocationDuplicationOptions
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<LocationDuplicateCheck>
   */
  private async checkForDuplicates(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<LocationDuplicateCheck> {
    // 1. Check by exact coordinates (highest priority)
    if (options.enableExactCoordinateMatching) {
      const exactCoordinateLocations = await this.locationRepository.findByExactCoordinates(
        data.latitude,
        data.longitude,
        prismaClient,
      );

      if (exactCoordinateLocations.length > 0) {
        return {
          isDuplicate: true,
          existingLocation: exactCoordinateLocations[0],
          matchReason: 'exact_coordinates',
        };
      }
    }

    // 2. Check by API source + API source ID (if both available and enabled)
    if (options.enableApiSourceMatching && data.apiSource && data.apiSourceId) {
      const apiSourceLocations = await this.locationRepository.findByApiSourceId(
        data.apiSource,
        data.apiSourceId,
        prismaClient,
      );

      if (apiSourceLocations.length > 0) {
        return {
          isDuplicate: true,
          existingLocation: apiSourceLocations[0],
          matchReason: 'api_source',
        };
      }
    }

    return {
      isDuplicate: false,
    };
  }

  /**
   * Get duplicate analysis for a location without creating it
   * @param data - Location data to analyze
   * @param options - LocationDeduplicationOptions
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @return Promise<LocationDuplicateCheck>
   */
  async analyzeDuplicates(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions = {},
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<LocationDuplicateCheck> {
    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };
    return await this.checkForDuplicates(data, deduplicationOptions, prismaClient);
  }
}

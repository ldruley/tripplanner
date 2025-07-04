import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Location } from '@trip-planner/types';
import { LocationRepository } from './location.repository';
import {
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationSearchCriteria,
  LocationDeduplicationOptions,
  LocationDuplicateCheck,
  DEFAULT_DEDUPLICATION_OPTIONS,
} from './location.types';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(private readonly locationRepository: LocationRepository) {}

  /**
   * Create a new location with deduplication
   */
  async create(data: CreateLocationRequest, options: LocationDeduplicationOptions = {}): Promise<Location> {
    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };

    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(data, deduplicationOptions);

    if (duplicateCheck.isDuplicate && duplicateCheck.existingLocation) {
      this.logger.debug(`Duplicate location found: ${duplicateCheck.matchReason}`);
      return duplicateCheck.existingLocation;
    }

    return await this.locationRepository.create(data);
  }

  /**
   * Create or update location (upsert with deduplication)
   */
  async upsert(data: CreateLocationRequest, options: LocationDeduplicationOptions = {}): Promise<Location> {
    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };

    // Check for duplicates
    const duplicateCheck = await this.checkForDuplicates(data, deduplicationOptions);

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

      // Only update if we have changes to make
      if (Object.keys(updateData).length > 0) {
        return await this.locationRepository.update(duplicateCheck.existingLocation.id, updateData);
      }

      // No changes needed, return existing location
      return duplicateCheck.existingLocation;
    }

    return await this.locationRepository.create(data);
  }

  /**
   * Find location by ID
   */
  async findById(id: string): Promise<Location> {
    const location = await this.locationRepository.findById(id);

    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return location;
  }

  /**
   * Search locations by criteria
   */
  async search(criteria: LocationSearchCriteria): Promise<Location[]> {
    return await this.locationRepository.search(criteria);
  }

  /**
   * Find locations near coordinates
   */
  async findNearby(latitude: number, longitude: number, radiusMeters = 1000): Promise<Location[]> {
    return await this.locationRepository.findByCoordinates(latitude, longitude, radiusMeters);
  }

  /**
   * Update location
   */
  async update(id: string, data: UpdateLocationRequest): Promise<Location> {
    // Verify location exists
    await this.findById(id);

    return await this.locationRepository.update(id, data);
  }

  /**
   * Delete location
   */
  async delete(id: string): Promise<void> {
    // Verify location exists
    await this.findById(id);

    await this.locationRepository.delete(id);
  }

  /**
   * Get all locations
   */
  async findAll(): Promise<Location[]> {
    return await this.locationRepository.findAll();
  }

  /**
   * Check for duplicate locations using simplified strategy - in the future this can be extended
   * 1. Exact coordinates match
   * 2. API source + API source ID match
   */
  private async checkForDuplicates(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions
  ): Promise<LocationDuplicateCheck> {
    // 1. Check by exact coordinates (highest priority)
    if (options.enableExactCoordinateMatching) {
      const exactCoordinateLocations = await this.locationRepository.findByExactCoordinates(
        data.latitude,
        data.longitude
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
        data.apiSourceId
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
   */
  async analyzeDuplicates(
    data: CreateLocationRequest,
    options: LocationDeduplicationOptions = {}
  ): Promise<LocationDuplicateCheck> {
    const deduplicationOptions = { ...DEFAULT_DEDUPLICATION_OPTIONS, ...options };
    return await this.checkForDuplicates(data, deduplicationOptions);
  }
}

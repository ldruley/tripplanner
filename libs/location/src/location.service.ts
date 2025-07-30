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
  ProcessedLocation,
  CreatedLocationMap,
  HereGeocodeApiResponse,
  HerePoiApiResponse,
  MapboxGeocodeApiResponse,
  MapboxPoiApiResponse,
} from '@trip-planner/types';
import {
  ApiSourceProvider,
  PrismaClientOrTransaction,
  Prisma,
  PrismaService,
} from '@trip-planner/prisma';
import { TimezoneService } from '@trip-planner/timezone';
import { LocationRepository } from './location.repository';
import {
  LocationDeduplicationOptions,
  LocationDuplicateCheck,
  DEFAULT_DEDUPLICATION_OPTIONS,
} from './location.types';
import { LocationProcessorService } from './location-processor.service';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly timezoneService: TimezoneService,
    private readonly locationProcessor: LocationProcessorService,
    private readonly prisma: PrismaService,
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

  // should refactor this to use repository model
  async processAndStoreExternalLocation(
    response:
      | HereGeocodeApiResponse
      | HerePoiApiResponse
      | MapboxGeocodeApiResponse
      | MapboxPoiApiResponse,
    provider: ApiSourceProvider,
  ): Promise<Location[]> {
    const locationsToCreate: Prisma.LocationCreateInput[] = [];

    if (provider === ApiSourceProvider.HERE && 'items' in response) {
      for (const item of (response as HereGeocodeApiResponse | HerePoiApiResponse).items) {
        locationsToCreate.push(this.locationProcessor.processHereFeature(item));
      }
    } else if (provider === ApiSourceProvider.MAPBOX && 'features' in response) {
      for (const feature of response.features) {
        locationsToCreate.push(this.locationProcessor.processMapboxFeature(feature));
      }
    } else {
      throw new Error('Unsupported API response structure or provider.');
    }

    const createdLocations = await this.prisma.location.createManyAndReturn({
      data: locationsToCreate,
    });

    return createdLocations as Location[];
  }

  /**
   * Batch create/find all locations with deduplication logic.
   * Reduces 2N + 2M location operations to ~3 operations total.
   * @param allLocationData - All processed location data.
   * @param prismaClient - Prisma client for transaction.
   * @return Map of created/found locations indexed by their type and original index.
   */
  async batchCreateLocations(
    allLocationData: ProcessedLocation[],
    prismaClient: PrismaClientOrTransaction,
  ): Promise<CreatedLocationMap> {
    const createdLocations: CreatedLocationMap = {};

    if (allLocationData.length === 0) {
      return createdLocations;
    }

    // Step 1: Extract all coordinates and API sources for bulk queries
    const allCoordinates = allLocationData.map(loc => ({
      latitude: loc.locationData.latitude,
      longitude: loc.locationData.longitude,
    }));

    const apiSourcePairs = allLocationData
      .filter(loc => loc.locationData.apiSource && loc.locationData.apiSourceId)
      .map(loc => ({
        apiSource: loc.locationData.apiSource!,
        apiSourceId: loc.locationData.apiSourceId!,
      }));

    // Step 2: Perform bulk duplicate checks (2 queries max instead of 2N queries)
    const [coordinateMatches, apiSourceMatches] = await Promise.all([
      this.locationRepository.findByCoordinatesIn(allCoordinates, prismaClient),
      apiSourcePairs.length > 0
        ? this.locationRepository.findByApiSourcesIn(apiSourcePairs, prismaClient)
        : Promise.resolve([]),
    ]);

    // Step 3: Create lookup maps for fast duplicate matching
    const coordinateMatchMap = new Map<string, Location>();
    coordinateMatches.forEach(location => {
      const key = `${location.latitude},${location.longitude}`;
      if (!coordinateMatchMap.has(key)) {
        coordinateMatchMap.set(key, location);
      }
    });

    const apiSourceMatchMap = new Map<string, Location>();
    apiSourceMatches.forEach(location => {
      if (location.apiSource && location.apiSourceId) {
        const key = `${location.apiSource},${location.apiSourceId}`;
        if (!apiSourceMatchMap.has(key)) {
          apiSourceMatchMap.set(key, location);
        }
      }
    });

    // Step 4: Process each location to find duplicates or mark for creation
    const locationsToCreate: CreateLocationRequest[] = [];
    const locationIndexMap = new Map<number, ProcessedLocation>();

    for (let i = 0; i < allLocationData.length; i++) {
      const processedLocation = allLocationData[i];
      const { locationData } = processedLocation;

      // Check for exact coordinate match (highest priority)
      const coordKey = `${locationData.latitude},${locationData.longitude}`;
      const coordinateMatch = coordinateMatchMap.get(coordKey);

      if (coordinateMatch) {
        const key = processedLocation.isBanked
          ? `banked_${processedLocation.originalIndex}`
          : `organized_${processedLocation.originalIndex}`;

        createdLocations[key] = coordinateMatch;
        this.logger.debug(
          `Found duplicate by coordinates for location ${i}: ${coordinateMatch.id}`,
        );
        continue;
      }

      // Check for API source match (secondary priority)
      if (locationData.apiSource && locationData.apiSourceId) {
        const apiKey = `${locationData.apiSource},${locationData.apiSourceId}`;
        const apiMatch = apiSourceMatchMap.get(apiKey);

        if (apiMatch) {
          const key = processedLocation.isBanked
            ? `banked_${processedLocation.originalIndex}`
            : `organized_${processedLocation.originalIndex}`;

          createdLocations[key] = apiMatch;
          this.logger.debug(`Found duplicate by API source for location ${i}: ${apiMatch.id}`);
          continue;
        }
      }

      // No duplicate found, mark for creation
      locationsToCreate.push(locationData);
      locationIndexMap.set(locationsToCreate.length - 1, processedLocation);
    }

    // Step 5: Bulk create remaining locations (1 query instead of N queries)
    if (locationsToCreate.length > 0) {
      this.logger.debug(`Creating ${locationsToCreate.length} new locations in bulk`);

      const createdLocationRecords = await prismaClient.location.createManyAndReturn({
        data: locationsToCreate.map(data => ({
          name: data.name,
          description: data.description || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          country: data.country || null,
          postalCode: data.postalCode,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
          apiSource: data.apiSource || null,
          apiSourceId: data.apiSourceId || null,
          category: data.category || null,
          extendedData: (data.extendedData as Prisma.InputJsonValue) || undefined,
        })),
      });

      // Map created locations back to their original indexes
      createdLocationRecords.forEach((location, createdIndex) => {
        const processedLocation = locationIndexMap.get(createdIndex);
        if (processedLocation) {
          const key = processedLocation.isBanked
            ? `banked_${processedLocation.originalIndex}`
            : `organized_${processedLocation.originalIndex}`;

          createdLocations[key] = location as Location;
        }
      });
    }

    this.logger.debug(
      `Batch location processing complete: ${Object.keys(createdLocations).length} locations processed, ${locationsToCreate.length} created, ${allLocationData.length - locationsToCreate.length} duplicates found`,
    );

    return createdLocations;
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

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { ValidationConfigService } from '@trip-planner/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { buildUrl } from '@trip-planner/utils';
import {
  ForwardGeocodeQuery,
  ReverseGeocodeQuery,
  HereGeocodeApiResponse,
  HereBaseFeature,
  Location,
} from '@trip-planner/types';
import { LocationProcessorService, LocationService } from '@trip-planner/location';
import { PrismaService } from '@trip-planner/prisma';
import { ApiSourceProvider } from '@prisma/client';

@Injectable()
export class HereGeocodeAdapterService {
  private readonly logger = new Logger(HereGeocodeAdapterService.name);
  private readonly apiKey: string;
  private readonly geocodeUrl: string;
  private readonly reverseGeocodeUrl =
    'https://reverse.geocode.search.hereapi.com/v1/reversegeocode';

  constructor(
    private readonly configService: ValidationConfigService,
    private readonly httpService: HttpService,
    private readonly locationProcessor: LocationProcessorService,
    private readonly locationService: LocationService,
    private readonly prisma: PrismaService,
  ) {
    const apiConfig = configService.getApiKeys();
    const urlConfig = configService.getApiUrls();

    this.apiKey = apiConfig.HERE_API_KEY;
    this.geocodeUrl = urlConfig.HERE_GEOCODE_URL;
  }

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<Location[]> {
    const url = buildUrl(this.geocodeUrl, '', { q: query.search, apiKey: this.apiKey, show: 'tz' });
    Logger.log(url);
    try {
      const response: AxiosResponse<HereGeocodeApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );
      
      // Process with LocationProcessorService and store, returning full Location objects
      return await this.processAndStoreLocations(response.data);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.search}"`, error);
      throw new BadGatewayException('Failed to perform forward geocoding');
    }
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<Location[]> {
    const url = buildUrl(this.reverseGeocodeUrl, '', {
      at: `${query.latitude},${query.longitude}`,
      apiKey: this.apiKey,
      show: 'tz',
    });
    try {
      const response: AxiosResponse<HereGeocodeApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );
      
      // Process with LocationProcessorService and store, returning full Location objects
      return await this.processAndStoreLocations(response.data);
    } catch (error) {
      this.logger.error(
        `Error during reverse geocoding with ${query.latitude} - ${query.longitude}`,
        error,
      );
      throw new BadGatewayException('Failed to perform reverse geocoding');
    }
  }

  /**
   * Process HERE API response and store locations with extended data using LocationProcessorService
   */
  private async processAndStoreLocations(apiResponse: HereGeocodeApiResponse): Promise<Location[]> {
    const locationsToCreate = apiResponse.items
      .filter(
        (feature: HereBaseFeature) =>
          feature.position && feature.position.lat != null && feature.position.lng != null,
      )
      .map((feature: HereBaseFeature) => 
        this.locationProcessor.processHereFeature(feature as any)
      );

    if (locationsToCreate.length === 0) {
      return [];
    }

    // Create all locations using LocationService which handles deduplication and preserves timezone data
    const createdLocations: Location[] = [];
    for (const locationData of locationsToCreate) {
      try {
        // Convert Prisma.LocationCreateInput to CreateLocationRequest
        const createLocationRequest = {
          name: locationData.name,
          description: locationData.description || undefined,
          address: locationData.address || undefined,
          houseNumber: locationData.houseNumber || undefined,
          city: locationData.city || undefined,
          state: locationData.state || undefined,
          country: locationData.country || undefined,
          postalCode: locationData.postalCode || undefined,
          latitude: locationData.latitude as number,
          longitude: locationData.longitude as number,
          apiSource: locationData.apiSource as any,
          apiSourceId: locationData.apiSourceId || undefined,
          timezone: locationData.timezone, // Preserve HERE timezone data
          category: locationData.category as any,
          public: locationData.public as boolean,
        };

        // Use LocationService.upsert() which handles deduplication and timezone preservation
        const created = await this.locationService.upsert(createLocationRequest);
        createdLocations.push(created);
      } catch (error) {
        this.logger.warn('Failed to upsert location:', {
          error: error instanceof Error ? error.message : String(error),
          locationData: { 
            name: locationData.name, 
            apiSourceId: locationData.apiSourceId,
            coordinates: `${locationData.latitude},${locationData.longitude}`
          }
        });
        // Continue processing other locations even if one fails
      }
    }

    this.logger.debug(`Successfully processed and stored ${createdLocations.length} locations from HERE geocoding`);
    return createdLocations;
  }

}

import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadGatewayException,
} from '@nestjs/common';
import { ValidationConfigService } from '@trip-planner/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { buildUrl } from '@trip-planner/utils';
import {
  PoiSearchQuery,
  HerePoiApiResponse,
  HerePlaceFeature,
  Location,
} from '@trip-planner/types';
import { LocationProcessorService, LocationService } from '@trip-planner/location';
import { PrismaService } from '@trip-planner/prisma';

@Injectable()
export class HerePoiAdapterService {
  private readonly logger = new Logger(HerePoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://discover.search.hereapi.com/v1/discover';

  constructor(
    private readonly configService: ValidationConfigService,
    private readonly httpService: HttpService,
    private readonly locationProcessor: LocationProcessorService,
    private readonly locationService: LocationService,
    private readonly prisma: PrismaService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    this.apiKey = apiKeys.HERE_API_KEY;
  }

  async searchPoi(query: PoiSearchQuery): Promise<Location[]> {
    //TODO: implement proximity in place of hardcoded location
    const url = buildUrl(this.baseUrl, '', {
      at: '36.97693,-122.030645',
      q: query.search,
      apiKey: this.apiKey,
      show: 'tz',
    });

    try {
      const response: AxiosResponse<HerePoiApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );
      Logger.log(response);
      
      // Process with LocationProcessorService and store, returning full Location objects
      return await this.processAndStoreLocations(response.data);
    } catch (error) {
      this.logger.error('Error fetching POI data', error);
      throw new BadGatewayException('Failed to search POI');
    }
  }


  /**
   * Process HERE POI API response and store locations with extended data using LocationProcessorService
   */
  private async processAndStoreLocations(apiResponse: HerePoiApiResponse): Promise<Location[]> {
    const locationsToCreate = apiResponse.items
      .filter(
        (feature: HerePlaceFeature) =>
          feature.position && feature.position.lat != null && feature.position.lng != null,
      )
      .map((feature: HerePlaceFeature) => 
        this.locationProcessor.processHereFeature(feature)
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

    this.logger.debug(`Successfully processed and stored ${createdLocations.length} locations from HERE POI search`);
    return createdLocations;
  }

}

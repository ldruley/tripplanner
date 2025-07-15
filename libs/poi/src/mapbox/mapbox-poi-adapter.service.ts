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
  MapboxPoiApiResponse,
  MapboxPoiFeature,
  PoiSearchQuery,
  Location,
} from '@trip-planner/types';
import { LocationProcessorService } from '@trip-planner/location';
import { PrismaService } from '@trip-planner/prisma';

@Injectable()
export class MapboxPoiAdapterService {
  private readonly SEARCH_URL = 'search/searchbox/v1/forward';
  private readonly logger = new Logger(MapboxPoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ValidationConfigService,
    private readonly httpService: HttpService,
    private readonly locationProcessor: LocationProcessorService,
    private readonly prisma: PrismaService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    const apiUrls = this.configService.getApiUrls();
    
    this.apiKey = apiKeys.MAPBOX_API_KEY;
    this.baseUrl = apiUrls.MAPBOX_BASE_URL;
  }

  async searchPoi(query: PoiSearchQuery): Promise<Location[]> {
    const url = buildUrl(this.baseUrl, this.SEARCH_URL, {
      q: query.search,
      access_token: this.apiKey,
    });
    this.logger.debug(`Searching POI with URL: ${url}`);
    try {
      const response: AxiosResponse<MapboxPoiApiResponse> = await firstValueFrom(
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
   * Process Mapbox POI API response and store locations with extended data using LocationProcessorService
   */
  private async processAndStoreLocations(apiResponse: MapboxPoiApiResponse): Promise<Location[]> {
    const locationsToCreate = apiResponse.features
      .filter(
        (feature: MapboxPoiFeature) =>
          feature.properties?.coordinates?.latitude != null &&
          feature.properties?.coordinates?.longitude != null,
      )
      .map((feature: MapboxPoiFeature) => 
        this.locationProcessor.processMapboxFeature(feature)
      );

    if (locationsToCreate.length === 0) {
      return [];
    }

    // Create all locations in bulk
    const createdLocations: Location[] = [];
    for (const locationData of locationsToCreate) {
      try {
        const created = await this.prisma.location.create({ 
          data: locationData 
        }) as unknown as Location;
        createdLocations.push(created);
      } catch (error) {
        this.logger.warn('Failed to create location, possibly duplicate:', {
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

    this.logger.debug(`Successfully processed and stored ${createdLocations.length} locations from Mapbox POI search`);
    return createdLocations;
  }

}

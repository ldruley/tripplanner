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
  MapboxGeocodeApiResponse,
  MapboxGeocodeFeature,
  ReverseGeocodeQuery,
  Location,
} from '@trip-planner/types';
import { LocationProcessorService } from '@trip-planner/location';
import { PrismaService } from '@trip-planner/prisma';

@Injectable()
export class MapboxGeocodeAdapterService {
  private readonly logger = new Logger(MapboxGeocodeAdapterService.name);
  private readonly apiBaseUrl = 'https://api.mapbox.com/search/geocode/v6/';
  private readonly apiKey: string;

  constructor(
    private configService: ValidationConfigService,
    private httpService: HttpService,
    private readonly locationProcessor: LocationProcessorService,
    private readonly prisma: PrismaService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    this.apiKey = apiKeys.MAPBOX_API_KEY;
  }

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<Location[]> {
    const url = buildUrl(this.apiBaseUrl, 'forward', {
      q: query.search,
      access_token: this.apiKey,
    });
    try {
      const response: AxiosResponse<MapboxGeocodeApiResponse> = await firstValueFrom(this.httpService.get(url));
      Logger.log(`Forward geocoding response for "${query.search}":`, response.data);
      
      // Process with LocationProcessorService and store, returning full Location objects
      return await this.processAndStoreLocations(response.data);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.search}"`, error);
      throw new BadGatewayException('Failed to perform forward geocoding');
    }
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<Location[]> {
    const url = buildUrl(this.apiBaseUrl, 'reverse', {
      longitude: query.longitude,
      latitude: query.latitude,
      access_token: this.apiKey,
    });
    Logger.log(`Geocoding [${query.latitude}, ${query.longitude}]`);
    try {
      const response: AxiosResponse<MapboxGeocodeApiResponse> = await firstValueFrom(this.httpService.get(url));
      Logger.log(
        `Reverse geocoding response for [${query.longitude}, ${query.latitude}]:`,
        response.data,
      );
      
      // Process with LocationProcessorService and store, returning full Location objects
      return await this.processAndStoreLocations(response.data);
    } catch (error) {
      this.logger.error(
        `Error during reverse geocoding with "${query.latitude} - ${query.longitude}"`,
        error,
      );
      throw new BadGatewayException('Failed to perform reverse geocoding');
    }
  }

  /**
   * Process Mapbox API response and store locations with extended data using LocationProcessorService
   */
  private async processAndStoreLocations(apiResponse: MapboxGeocodeApiResponse): Promise<Location[]> {
    if (!apiResponse || !apiResponse.features) {
      return [];
    }

    const locationsToCreate = apiResponse.features
      .filter(
        (feature: MapboxGeocodeFeature) =>
          feature.properties?.coordinates?.latitude != null &&
          feature.properties?.coordinates?.longitude != null,
      )
      .map((feature: MapboxGeocodeFeature) => 
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

    this.logger.debug(`Successfully processed and stored ${createdLocations.length} locations from Mapbox geocoding`);
    return createdLocations;
  }

}

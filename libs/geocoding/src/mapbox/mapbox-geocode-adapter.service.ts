import { Injectable, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { buildUrl } from '@trip-planner/utils';
import {
  ForwardGeocodeQuery,
  GeocodingResult, GeocodingResultSchema, MapboxGeocodeApiResponse, MapboxGeocodeFeature,
  ReverseGeocodeQuery
} from '@trip-planner/types';

@Injectable()
export class MapboxGeocodeAdapterService {
  private readonly logger = new Logger(MapboxGeocodeAdapterService.name);
  private readonly apiBaseUrl = 'https://api.mapbox.com/search/geocode/v6/';
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('MAPBOX_API_KEY') ?? (() => {
      this.logger.error('Mapbox access token is not configured');
      throw new InternalServerErrorException('Mapbox access token is required');
    })();
  }

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<GeocodingResult[]> {
    const url = buildUrl(this.apiBaseUrl, 'forward', { q: query.search, access_token: this.apiKey });
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url)
      );
      Logger.log(`Forward geocoding response for "${query.search}":`, response.data);
      return this.processResponse(response.data);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.search}"`, error);
      throw new BadGatewayException('Failed to perform forward geocoding');
    }
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<GeocodingResult[]> {
    const url = buildUrl(this.apiBaseUrl, 'reverse', { longitude: query.longitude, latitude: query.latitude, access_token: this.apiKey });
    Logger.log(`Geocoding [${query.latitude}, ${query.longitude}]`)
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(url)
      );
      Logger.log(`Reverse geocoding response for [${query.longitude}, ${query.latitude}]:`, response.data);
      return this.processResponse(response.data);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.latitude} - ${query.longitude}"`, error);
      throw new BadGatewayException('Failed to perform reverse geocoding');
    }
  }

  async processResponse(response: MapboxGeocodeApiResponse): Promise<GeocodingResult[]> {
    if(response && response.features) {
      return response.features
        .filter((feature: MapboxGeocodeFeature) => feature.properties?.coordinates?.latitude != null && feature.properties?.coordinates?.longitude != null)
        .map((feature: MapboxGeocodeFeature) => {
          const location: Partial<GeocodingResult> = {
            latitude: feature.properties?.coordinates?.latitude,
            longitude: feature.properties?.coordinates?.longitude,
            fullAddress: feature.properties?.full_address || 'No address found',
            streetAddress:
              feature.properties?.name || 'No street address found',
            provider: 'mapbox',
            providerId: feature.properties?.mapbox_id,
            country:
              feature.properties?.context?.country?.name || 'No country found',
            region:
              feature.properties?.context?.region?.name || 'No region found',
            city: feature.properties?.context?.place?.name || 'No city found',
            postalCode:
              feature.properties?.context?.postcode?.name ||
              'No postal code found',
            rawResponse:
              process.env['NODE_ENV'] === 'development' ? feature : undefined,
          };

          // Use Zod to parse. This will throw an error if the data doesn't match our schema.
          return GeocodingResultSchema.parse(location);
        });
    }
    return [];
  }
}

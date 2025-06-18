import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  ForwardGeocodeQueryDto,
  GeocodingResult,
  GeocodingResultSchema, ReverseGeocodeQueryDto
} from '../../../shared/types/src/schemas/geocoding.schema';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { buildUrl } from '@trip-planner/utils';


@Injectable()
export class HereGeocodeAdapterService {
  private readonly logger = new Logger(HereGeocodeAdapterService.name);
  private readonly apiKey: string;
  private readonly geocodeUrl = 'https://geocode.search.hereapi.com/v1/geocode';
  private readonly reverseGeocodeUrl = 'https://reverse.geocode.search.hereapi.com/v1/reversegeocode';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('HERE_API_KEY') ?? (() => {
      this.logger.error('Here access token is not configured');
      throw new Error('Here access token is required');
    })();
  }

  async forwardGeocode(query: ForwardGeocodeQueryDto): Promise<GeocodingResult[]> {
    const url = buildUrl(this.geocodeUrl, '', { q: query.search, apiKey: this.apiKey });
    Logger.log(url);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url)
      );
      return this.processResponse(response);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.search}"`, error);
      throw new Error('Failed to perform forward geocoding');
    }
  }

  async reverseGeocode(query: ReverseGeocodeQueryDto): Promise<GeocodingResult[]> {
    const url = buildUrl(this.reverseGeocodeUrl, '', { at: `${query.latitude},${query.longitude}`, apiKey: this.apiKey});
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url)
      );
      return this.processResponse(response);
      } catch (error) {
      this.logger.error(`Error during forward geocoding with ${query.latitude} - ${query.longitude}`, error);
      throw new Error('Failed to perform forward geocoding');
    }
  }

  async processResponse(response: any): Promise<GeocodingResult[]> {
    if (response) {
      return response.data.items.map((feature: any) => {
        const location: Partial<GeocodingResult> = {
          latitude: feature.position.lat,
          longitude: feature.position.lng,
          fullAddress: feature.address?.label || 'No address available',
          streetAddress: feature.address?.houseNumber + feature.address?.street || 'No street address available',
          provider: 'here',
          providerId: feature.id,
          country: feature.address?.countryName || 'Unknown country',
          city: feature.address?.city || 'Unknown city',
          region: feature.address?.state || 'Unknown region',
          postalCode: feature.address?.postalCode || 'Unknown postal code',
          rawResponse:
            process.env['NODE_ENV'] === 'development' ? feature : undefined,
        };
        return GeocodingResultSchema.parse(location);
      });
    }
    return [];
  }
}

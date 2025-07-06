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
  GeocodingResult,
  GeocodingResultSchema,
  ReverseGeocodeQuery,
  HerePoiApiResponse,
  HereGeocodeApiResponse,
  HereBaseFeature,
} from '@trip-planner/types';

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
  ) {
    const apiConfig = configService.getApiKeys();
    const urlConfig = configService.getApiUrls();
    
    this.apiKey = apiConfig.HERE_API_KEY;
    this.geocodeUrl = urlConfig.HERE_GEOCODE_URL;
  }

  async forwardGeocode(query: ForwardGeocodeQuery): Promise<GeocodingResult[]> {
    const url = buildUrl(this.geocodeUrl, '', { q: query.search, apiKey: this.apiKey });
    Logger.log(url);
    try {
      const response: AxiosResponse<HerePoiApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );
      return this.processResponse(response);
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${query.search}"`, error);
      throw new BadGatewayException('Failed to perform forward geocoding');
    }
  }

  async reverseGeocode(query: ReverseGeocodeQuery): Promise<GeocodingResult[]> {
    const url = buildUrl(this.reverseGeocodeUrl, '', {
      at: `${query.latitude},${query.longitude}`,
      apiKey: this.apiKey,
    });
    try {
      const response: AxiosResponse<HerePoiApiResponse> = await firstValueFrom(
        this.httpService.get(url),
      );
      return this.processResponse(response);
    } catch (error) {
      this.logger.error(
        `Error during reverse geocoding with ${query.latitude} - ${query.longitude}`,
        error,
      );
      throw new BadGatewayException('Failed to perform reverse geocoding');
    }
  }

  async processResponse(
    response: AxiosResponse<HereGeocodeApiResponse>,
  ): Promise<GeocodingResult[]> {
    if (response) {
      return response.data.items
        .filter(
          (feature: HereBaseFeature) =>
            feature.position && feature.position.lat != null && feature.position.lng != null,
        )
        .map((feature: HereBaseFeature) => {
          const location: Partial<GeocodingResult> = {
            latitude: feature.position?.lat,
            longitude: feature.position?.lng,
            fullAddress: feature.address?.label || 'No address available',
            streetAddress:
              [feature.address?.houseNumber, feature.address?.street].filter(Boolean).join(' ') ||
              'Unknown street address',
            provider: 'here',
            providerId: feature.id,
            country: feature.address?.countryName || 'Unknown country',
            city: feature.address?.city || 'Unknown city',
            region: feature.address?.state || 'Unknown region',
            postalCode: feature.address?.postalCode || 'Unknown postal code',
            rawResponse: process.env['NODE_ENV'] === 'development' ? feature : undefined,
          };
          return GeocodingResultSchema.parse(location);
        });
    }
    return [];
  }
}

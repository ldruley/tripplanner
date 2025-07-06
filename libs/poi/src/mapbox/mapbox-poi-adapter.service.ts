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
  PoiSearchResult,
  PoiSearchResultSchema,
} from '@trip-planner/types';

@Injectable()
export class MapboxPoiAdapterService {
  private readonly SEARCH_URL = 'search/searchbox/v1/forward';
  private readonly logger = new Logger(MapboxPoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ValidationConfigService,
    private readonly httpService: HttpService,
  ) {
    const apiKeys = this.configService.getApiKeys();
    const apiUrls = this.configService.getApiUrls();
    
    this.apiKey = apiKeys.MAPBOX_API_KEY;
    this.baseUrl = apiUrls.MAPBOX_BASE_URL;
  }

  async searchPoi(query: PoiSearchQuery): Promise<PoiSearchResult[]> {
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
      const results = response.data.features.map((feature: MapboxPoiFeature) => {
        const location: Partial<PoiSearchResult> = {
          latitude: feature.properties?.coordinates?.latitude,
          longitude: feature.properties?.coordinates?.longitude,
          name: feature.properties?.name || 'Unknown',
          fullAddress: feature.properties?.full_address || 'No address available',
          streetAddress: feature.properties?.address || 'No street address available',
          provider: 'mapbox',
          providerId: feature.properties?.mapbox_id,
          country: feature.properties?.context?.country?.name || 'Unknown country',
          city: feature.properties?.context?.place?.name || 'Unknown city',
          region: feature.properties?.context?.region?.name || 'Unknown region',
          postalCode: feature.properties?.context?.postcode?.name || 'Unknown postal code',
          rawResponse: this.configService.isDevelopment() ? feature : undefined,
        };

        const parsed = PoiSearchResultSchema.safeParse(location);
        if (!parsed.success) {
          this.logger.warn('Invalid POI result from Mapbox', {
            errors: parsed.error.flatten(),
            source: feature,
          });
          return null;
        }
        return parsed.data;
      });
      return results.filter((item): item is PoiSearchResult => item !== null);
    } catch (error) {
      this.logger.error('Error fetching POI data', error);
      throw new BadGatewayException('Failed to search POI');
    }
  }
}

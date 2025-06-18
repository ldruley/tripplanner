import { Injectable, Logger } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import { PoiSearchResult, PoiSearchResultSchema } from '../../../shared/types/src/schemas/search.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

@Injectable()
export class MapboxPoiAdapterService {
  private readonly SEARCH_URL = 'search/searchbox/v1/forward';
  private readonly logger = new Logger(MapboxPoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {

    this.apiKey = this.configService.get<string>('MAPBOX_API_KEY') ?? (() => {
      this.logger.error('Mapbox access token is not configured.');
      throw new Error('Mapbox access token is required');
    })();

    this.baseUrl = this.configService.get<string>('MAPBOX_BASE_URL') ?? (() => {
      this.logger.error('Mapbox base URL is not configured.');
      throw new Error('Mapbox base URL is required');
    })();
  }

  private buildUrl(endpoint: string, queryParams: Record<string, string | number>): string {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set('access_token', this.apiKey);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value.toString());
      }
    }
    return url.toString();
  }

  async searchPoi(query: string): Promise<PoiSearchResult[]> {
    const url = this.buildUrl(this.SEARCH_URL, { q: query });
    this.logger.debug(`Searching POI with URL: ${url}`);
    try {
      const response: AxiosResponse<any>  = await firstValueFrom(this.httpService.get(url));
      Logger.log(response);
      return response.data.features.map((feature: any) => {
        const location: Partial<PoiSearchResult> = {
          latitude: feature.properties.coordinates.latitude,
          longitude: feature.properties.coordinates.longitude,
          name: feature.properties?.name || 'Unknown',
          fullAddress: feature.properties?.full_address || 'No address available',
          streetAddress: feature.properties.address || 'No street address available',
          provider: 'mapbox',
          providerId: feature.properties.mapbox_id,
          country: feature.properties?.context?.country?.name || 'Unknown country',
          city: feature.properties?.context?.place?.name || 'Unknown city',
          region: feature.properties?.context?.region?.name || 'Unknown region',
          postalCode: feature.properties?.context?.postcode?.name || 'Unknown postal code',
          rawResponse:
            process.env['NODE_ENV'] === 'development' ? feature : undefined,
        };

        return PoiSearchResultSchema.parse(location);
      });
    } catch (error) {
      this.logger.error('Error searching POI:', error);
      throw new Error('Failed to search POI');
    }
  }
}

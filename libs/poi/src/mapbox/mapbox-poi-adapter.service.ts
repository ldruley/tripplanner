import { Injectable, Logger } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import { PoiSearchResult, PoiSearchResultSchema } from '../../../shared/types/src/schemas/search.schema';
import * as axios from 'axios';

@Injectable()
export class MapboxPoiAdapterService {
  private readonly SEARCH_URL = '/search/searchbox/v1/forward';
  private readonly logger = new Logger(MapboxPoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('MAPBOX_API_KEY');
    this.baseUrl = this.baseUrl = this.configService.get<string>
    if (!this.apiKey) {
      this.logger.error('Mapbox access token is not configured.');
      throw new Error('Mapbox access token is required');
    }
  }

  private buildUrl(endpoint: string, queryParams: Record<string, string | number>): string {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set('apiKey', this.apiKey); // or use headers depending on API
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value.toString());
      }
    }
    return url.toString();
  }

  async searchPoi(query: string): Promise<PoiSearchResult> {
    const url = this.buildUrl(this.SEARCH_URL, { q: query });
    this.logger.debug(`Searching POI with URL: ${url}`);
    try {
      const response = await axios.get(url);
      return response.data.features.map((feature: any) => {
        const location: Partial<PoiSearchResult> = {
          latitude: feature.coordinates.latitude,
          longitude: feature.coordinates.longitude,
          name: feature.properties.name,
          fullAddress: feature.properties.full_address,
          streetAddress: feature.properties.address,
          provider: 'mapbox',
          providerId: feature.properties.mapbox_id,
          country: feature.properties.context.country.name,
          city: feature.properties.place.name,
          state: feature.properties.context.region.name,
          postalCode: feature.properties.context.postcode,
          rawResponse: process.env.NODE_ENV === 'development' ? feature : undefined,
        };

        return PoiSearchResultSchema.parse(location);
      });
    } catch (error) {
      this.logger.error('Error searching POI:', error);
      throw new Error('Failed to search POI');
    }
  }
}

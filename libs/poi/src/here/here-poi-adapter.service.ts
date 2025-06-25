import { Injectable, Logger } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import {
  PoiSearchQueryDto,
  PoiSearchResult,
  PoiSearchResultSchema
} from '../../../shared/types/src/schemas/search.schema';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { buildUrl } from '@trip-planner/utils';

@Injectable()
export class HerePoiAdapterService {
  private readonly logger = new Logger(HerePoiAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://discover.search.hereapi.com/v1/discover';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('HERE_API_KEY') ?? (() => {
      this.logger.error('Here access token is not configured.');
      throw new Error('Here access token is required');
    })();
  }

  async searchPoi(query: PoiSearchQueryDto): Promise<PoiSearchResult[]> {
    const url = buildUrl(this.baseUrl, '', {at: '36.97693,-122.030645', q: query.search, apiKey: this.apiKey});

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url),
      );
      Logger.log(response);
      return response.data.items.map((feature: any) => {
        const location: Partial<PoiSearchResult> = {
          latitude: feature.position.lat,
          longitude: feature.position.lng,
          name: feature.title || 'Unknown',
          fullAddress: feature.address?.label || 'No address available',
          streetAddress: feature.address?.houseNumber + ' ' + feature.address?.street || 'No street address available',
          provider: 'here',
          providerId: feature.id,
          country: feature.address?.countryName || 'Unknown country',
          city: feature.address?.city || 'Unknown city',
          region: feature.address?.state || 'Unknown region',
          postalCode: feature.address?.postalCode || 'Unknown postal code',
          rawResponse:
            process.env['NODE_ENV'] === 'development' ? feature : undefined,
        };

        return PoiSearchResultSchema.parse(location);
      });
    } catch (error) {
      this.logger.error('Error fetching POI data', error);
      throw error;
    }
  }
}

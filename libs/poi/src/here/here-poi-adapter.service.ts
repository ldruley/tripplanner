import { Injectable, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { buildUrl } from '@trip-planner/utils';
import { PoiSearchQuery, PoiSearchResult, PoiSearchResultSchema } from '@trip-planner/types';

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
      throw new InternalServerErrorException('Here access token is required');
    })();
  }

  async searchPoi(query: PoiSearchQuery): Promise<PoiSearchResult[]> {
    //TODO: implement proximity in place of hardcoded location
    const url = buildUrl(this.baseUrl, '', {at: '36.97693,-122.030645', q: query.search, apiKey: this.apiKey});

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url),
      );
      Logger.log(response);
      const results: Array<PoiSearchResult | null> = response.data.items.map((feature: any) => {
        const location: Partial<PoiSearchResult> = {
          latitude: feature.position?.lat,
          longitude: feature.position?.lng,
          name: feature.title || 'Unknown',
          fullAddress: feature.address?.label || 'No address available',
          streetAddress: `${feature.address?.houseNumber ?? ''} ${feature.address?.street ?? ''}`.trim() || 'No street address available',
          provider: 'here',
          providerId: feature.id,
          country: feature.address?.countryName || 'Unknown country',
          city: feature.address?.city || 'Unknown city',
          region: feature.address?.state || 'Unknown region',
          postalCode: feature.address?.postalCode || 'Unknown postal code',
          rawResponse:
            process.env['NODE_ENV'] === 'development' ? feature : undefined,
        };

        const parsed = PoiSearchResultSchema.safeParse(location);
        if (!parsed.success) {
          this.logger.warn('Invalid POI result from HERE', {
            errors: parsed.error.flatten(),
            source: feature
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

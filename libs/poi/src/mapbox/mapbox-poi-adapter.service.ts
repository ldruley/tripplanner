import { Injectable, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService} from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { buildUrl } from '@trip-planner/utils';
import { PoiSearchQuery, PoiSearchResult, PoiSearchResultSchema } from '@trip-planner/types';

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
      throw new InternalServerErrorException('Mapbox access token is required');
    })();

    this.baseUrl = this.configService.get<string>('MAPBOX_BASE_URL') ?? (() => {
      this.logger.error('Mapbox base URL is not configured.');
      throw new InternalServerErrorException('Mapbox base URL is required');
    })();
  }

  async searchPoi(query: PoiSearchQuery): Promise<PoiSearchResult[]> {
    //TODO missing api key
    const url = buildUrl(this.baseUrl, this.SEARCH_URL, { q: query.search });
    this.logger.debug(`Searching POI with URL: ${url}`);
    try {
      const response: AxiosResponse<any>  = await firstValueFrom(this.httpService.get(url));
      Logger.log(response);
      return response.data.features
        .map((feature: any) => {
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
            rawResponse:
              process.env['NODE_ENV'] === 'development' ? feature : undefined,
          };

          const parsed = PoiSearchResultSchema.safeParse(location);
          if (!parsed.success) {
            this.logger.warn('Invalid POI result from Mapbox', {
              errors: parsed.error.flatten(),
              source: feature
            });
            return null;
          }
          return parsed.data;
        })
        .filter((result: any): result is PoiSearchResult => result !== null);
    } catch (error) {
      this.logger.error('Error fetching POI data', error);
      throw new BadGatewayException('Failed to search POI');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MapboxClient from '@mapbox/mapbox-sdk';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

import { GeocodingResult, GeocodingResultSchema} from '../../../shared/types/src/schemas/geocoding.schema';

@Injectable()
export class MapboxAdapterService {
  private readonly geocodingClient: any;
  private readonly logger = new Logger(MapboxAdapterService.name);

  constructor(private configService: ConfigService) {
    const accessToken = this.configService.get<string>('MAPBOX_API_KEY');
    if (!accessToken) {
      this.logger.error('Mapbox access token is not configured.');
      throw new Error('Mapbox access token is required');
    }
    this.geocodingClient = MapboxGeocoding({ accessToken });
  }

  async forwardGeocode(search: string): Promise<GeocodingResult[]> {
    try {
      const response = await this.geocodingClient
        .forwardGeocode({
          query: search,
          limit: 5,
        })
        .send();
      Logger.log(`Forward geocoding response for "${search}":`, response.body);
      const normalizedResults = response.body.features.map((feature: any) => {
        const location: Partial<GeocodingResult> = {
          latitude: feature.center[1],
          longitude: feature.center[0],
          fullAddress: feature.place_name,
          streetAddress: `${feature.address} ${feature.text}`.trim(),
          provider: 'mapbox',
          providerId: feature.id,
          country: this.findInContext(feature, 'country'),
          region: this.findInContext(feature, 'region'),
          city: this.findInContext(feature, 'place'),
          postalCode: this.findInContext(feature, 'postcode'),
          rawResponse: process.env.NODE_ENV === 'development' ? feature : undefined,
        };

        // Use Zod to parse. This will throw an error if the data doesn't match our schema.
        try {
          return GeocodingResultSchema.parse(location);
        } catch (zodError) {
          this.logger.error('[DEBUG] Zod validation failed!', zodError);
        }
      });

      return normalizedResults;
    } catch (error) {
      this.logger.error(`Error during forward geocoding with "${search}"`, error);
      throw new Error('Failed to perform forward geocoding');
    }
  }

  private findInContext(feature: any, type: string): string | null {
      const context = feature.context?.find((ctx: any) => ctx.id.startsWith(type));
      return context?.text || null;
    }
}



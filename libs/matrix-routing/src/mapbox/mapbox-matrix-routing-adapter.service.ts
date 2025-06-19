import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  CoordinateMatrixDto,
  CoordinateMatrixSchema,
  MatrixQueryDto
} from '../../../shared/types/src/schemas/matrix.schema';
import { buildUrl } from '@trip-planner/utils';
import { Coordinate } from '@trip-planner/types';
import { toCoordinateKey} from '../../../shared/types/src/schemas/matrix.schema';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';


@Injectable()
export class MapboxMatrixRoutingAdapterService {
  private readonly logger = new Logger(MapboxMatrixRoutingAdapterService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly matrixEndpoint = 'directions-matrix/v1/mapbox/driving/';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
      this.apiKey = this.configService.get<string>('MAPBOX_API_KEY') ?? (() => {
        this.logger.error('MAPBOX_API_KEY is not set');
        throw new Error('MAPBOX_API_KEY is not set');
      }) ();

      this.baseUrl = this.configService.get<string>('MAPBOX_BASE_URL') ?? (() => {
          this.logger.error('MAPBOX_BASE_URL is not set');
          throw new Error('MAPBOX_BASE_URL is not set');
      }) ();
  }

  //TODO: handle url creation better
  async getMatrixRouting(query: MatrixQueryDto): Promise<CoordinateMatrixDto> {
    const origins = this.buildMapboxOriginsParam(query.origins);
    Logger.log('query:' + JSON.stringify(query), MapboxMatrixRoutingAdapterService.name);
    const url = `${this.baseUrl}/${this.matrixEndpoint}${origins}?access_token=${this.apiKey}`;
    this.logger.debug('URL: ' + url);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url)
      );

      this.logger.debug('Matrix response: ' + JSON.stringify(response.data));
      return this.mapMatrixResponseToCoordinateMatrix({
        origins: query.origins,
        travelTimes: response.data.durations,
        distances: response.data.distances
      });
    } catch(error) {
      this.logger.error('Error fetching matrix routing: ' + error);
      throw new Error('Failed to fetch matrix routing from Mapbox');
    }
  }

  mapMatrixResponseToCoordinateMatrix({
      origins,
      travelTimes,
      distances
    }: {
    origins: Coordinate[],
    travelTimes: number[][],
    distances: number[][] })
    : CoordinateMatrixDto {
    const result: Record<string, Record<string, {time: number; distance: number}>> = {};
    const n = origins.length;
    for(let i = 0; i < n; i++) {
      const originKey = toCoordinateKey(origins[i]);
      result[originKey] = {};
      for(let j = 0; j < n; j++) {
        const destinationKey = toCoordinateKey(origins[j]);
        result[originKey][destinationKey] = {
          time: travelTimes[i][j],
          distance: distances[i][j]
        };
      }
    }

    return CoordinateMatrixSchema.parse(result);
  }

  buildMapboxOriginsParam(coords: Coordinate[]): string {
    return coords.map(toCoordinateKey).join(';');
  }
}

import { Injectable, Logger, InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  Coordinate,
  CoordinateMatrix,
  CoordinateMatrixSchema, MatrixQuery,
  toCoordinateKey
} from '@trip-planner/types';


@Injectable()
export class HereMatrixRoutingAdapterService {
  private readonly logger = new Logger(HereMatrixRoutingAdapterService.name);
  private readonly apiKey: string;
  private readonly matrixUrl = 'https://matrix.router.hereapi.com/v8/matrix?async=false';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
      this.apiKey = this.configService.get<string>('HERE_API_KEY') ?? (() => {
      this.logger.error('HERE_API_KEY is not set');
      throw new InternalServerErrorException('HERE_API_KEY is required');
    })();
  }

  async getMatrixRouting(query: MatrixQuery): Promise<CoordinateMatrix> {
    Logger.log('query: ' + JSON.stringify(query), HereMatrixRoutingAdapterService.name);
    const body = {
      origins: query.origins,
      regionDefinition: { type: 'world' },
      matrixAttributes: ['travelTimes', 'distances'],
    };

    const url = `${this.matrixUrl}/matrix`;
    const params = {
      apiKey: this.apiKey,
      async: false,
    };

    this.logger.debug('Matrix URL: ' + url);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.post(url, body, {params})
      );

      this.logger.debug(`Matrix response: ${JSON.stringify(response.data)}`);
      return this.mapMatrixResponseToCoordinateMatrix({
        origins: query.origins,
        travelTimes: response.data.matrix.travelTimes,
        distances: response.data.matrix.distances,
      });
    } catch(error) {
      this.logger.error('Error fetching matrix data', error);
      throw new BadGatewayException('Failed to fetch matrix data from HERE API');
    }
  }

  mapMatrixResponseToCoordinateMatrix({
      origins,
      travelTimes,
      distances,
    }: {
    origins: Coordinate[];
    travelTimes: number[];
    distances: number[];
  }) {
    const result: Record<string, Record<string, { time: number; distance: number }>> = {};

    const n = origins.length;

    for (let i = 0; i < n; i++) {
      const originKey = toCoordinateKey(origins[i]);
      result[originKey] = {};

      for (let j = 0; j < n; j++) {
        const destKey = toCoordinateKey(origins[j]);
        const index = i * n + j;

        result[originKey][destKey] = {
          time: travelTimes[index],
          distance: distances[index],
        };
      }
    }

    return CoordinateMatrixSchema.parse(result);
  }
}

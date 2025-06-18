import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MatrixQueryDto } from '../../../shared/types/src/schemas/matrix.schema';
import { buildUrl } from '@trip-planner/utils';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';


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
      throw new Error('HERE_API_KEY is required');
    })();
  }

  async getMatrixRouting(query: MatrixQueryDto): Promise<any> {
    const url = buildUrl(
      this.matrixUrl,
      '',
      {
        origins: query.origins,
        async: false
      }
    );
    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url)
      );

      this.logger.debug(`Matrix response: ${JSON.stringify(response.data)}`);
    } catch(error) {
      this.logger.error('Error fetching matrix data', error);
    }
    return null;
  }
}

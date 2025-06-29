import { Injectable, Logger, LoggerService, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { Job, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TimezoneRequest, TimezoneResponse, TimezoneResponseSchema } from '@trip-planner/types';
import { buildUrl } from '@trip-planner/utils';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class TimezoneWorker implements OnModuleInit {
  private worker!: Worker;
  private apiKey!: string;
  private baseUrl!: string;
  private readonly QUEUE_NAME = 'timezone-requests';
  private readonly logger = new Logger(TimezoneWorker.name);

  constructor(
    private readonly bullmqService: BullMQService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('TIMEZONEDB_API_KEY') ?? (() => {
      this.logger.error('TIMEZONEDB_API_KEY is not set');
      throw new Error('TIMEZONEDB_API_KEY is reguired');
    })();

    this.baseUrl = this.configService.get<string>('TIMEZONEDB_BASE_URL') ?? 'https://api.timezonedb.com/v2.1';
  }

  async onModuleInit() {
    this.worker = this.bullmqService.createWorker({
      name: this.QUEUE_NAME,
      processor: this.processTimezoneJob.bind(this),
      concurrency: 1, // Process one job at a time
      limiter: {
        max: 1, // Maximum 1 job
        duration: 1000, // Per 1000ms (1 second)
      },
    });

    console.log('Timezone worker started');
  }

  /**
   * Process timezone job
   */
  private async processTimezoneJob(job: Job<TimezoneRequest>): Promise<TimezoneResponse> {
    const query = job.data;

    try {
      let timezoneData: TimezoneResponse;
      if(query.requestId === undefined) {
        this.logger.warn('Timezone job is missing requestId, generating a new one');
        query.requestId = crypto.randomUUID();
      }
      if (query.latitude !== undefined && query.longitude !== undefined) {
        timezoneData = await this.fetchTimezoneByCoordinates(query.latitude, query.longitude, query.requestId);
      } else { // should never happen due to validation
        throw new Error('Cooridinates are required for timezone lookup');
      }

      // Add processing delay to ensure we don't exceed rate limit
      await this.delay(100); // Small buffer

      return timezoneData;
    } catch (error) {
      console.error(`Timezone job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async fetchTimezoneByCoordinates(
    latitude: number,
    longitude: number,
    requestId: string,
  ): Promise<TimezoneResponse> {
    const url = buildUrl(this.baseUrl, '/get-time-zone', { lat: latitude, lng: longitude, key: this.apiKey, format: 'json', by: 'position' });
    this.logger.debug(`Seaching timezone with url: ${url}`);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(this.httpService.get(url));
      this.logger.debug(`Timezone response: ${JSON.stringify(response.data)}`);
      const timezone: TimezoneResponse = {
        timezone: response.data.zoneName,
        requestId,
      }
      return TimezoneResponseSchema.parse(timezone);

    } catch (error) {
      this.logger.error(`Failed to fetch timezone by coordinates: ${error}`);
      throw new Error('Failed to fetch timezone by coordinates');
    }
  }

  // we may be able to split out request logic if we don't need any custom logic per endpoint
  private async fetchTimezoneByCity(
    city: string,
    requestId: string,
  ): Promise<TimezoneResponse> {
    const url = buildUrl(this.baseUrl, '/get-time-zone', { city, key: this.apiKey, format: 'json', by: 'position' });
    this.logger.debug(`Seaching timezone with url: ${url}`);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(this.httpService.get(url));
      this.logger.debug(`Timezone response: ${JSON.stringify(response.data)}`);
      const timezone: TimezoneResponse = {
        timezone: response.data.zoneName,
        requestId,
      }
      return TimezoneResponseSchema.parse(timezone);

    } catch (error) {
      this.logger.error(`Failed to fetch timezone by coordinates: ${error}`);
      throw new Error('Failed to fetch timezone by coordinates');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}


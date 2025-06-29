import { Injectable, Logger, LoggerService, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { Job, Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { TimezoneRequest, TimezoneResponse } from '@trip-planner/types';
import { buildUrl } from '@trip-planner/utils';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

export class TimezoneWorker implements OnModuleInit {
  private worker: Worker;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly QUEUE_NAME = 'timezone-requests';
  private readonly logger = new Logger(MapboxPoiAdapterService.name);

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

      if (query.latitude !== undefined && query.longitude !== undefined) {
        timezoneData = await this.fetchTimezoneByCoordinates(query.latitude, query.longitude, query.requestId);
      } else if (query.city) {
        timezoneData = await this.fetchTimezoneByCity(query.city, query.requestId);
      } else { // should never happen due to validation
        throw new Error('Either coordinates or city must be provided');
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
    const url = buildUrl(this.baseUrl, '/get-time-zone', { latitude, longitude, key: this.apiKey, format: 'json', by: 'position' });
    this.logger.debug(`Seaching timezone with url: ${url}`);
    try {
      const response: AxiosResponse<any> = await firstValueFrom(this.httpService.get(url));
      this.logger.debug(`Timezone response: ${JSON.stringify(response.data)}`);

    }
    if (!response.ok) {
      throw new Error(`Failed to fetch timezone for coordinates: ${latitude}, ${longitude}`);
    }
    const data = await response.json();
    return {
      requestId,
      ...data,
    };
  }

}


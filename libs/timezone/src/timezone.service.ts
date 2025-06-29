import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { RedisService } from '@trip-planner/redis';
import { Job, Queue, QueueEvents } from 'bullmq';
import { Coordinate, TimezoneRequest, TimezoneResponse } from '@trip-planner/types';
import { buildCacheKey } from '@trip-planner/utils';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TimezoneService implements OnModuleInit, OnModuleDestroy {
  private timezoneQueue!: Queue;
  private queueEvents!: QueueEvents;

  private readonly CACHE_TTL = 7 * 24 * 60 * 60;
  private readonly logger = new Logger(TimezoneService.name);
  private readonly QUEUE_NAME = 'timezone-requests';
  private readonly apiKey: string;
  private readonly baseUrl: string;


  constructor(
    private readonly bullmqService: BullMQService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.timezoneQueue = this.bullmqService.createQueue({
      name: this.QUEUE_NAME,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // TODO: This is temporary here until we implement a proper worker process
    this.queueEvents = new QueueEvents(this.QUEUE_NAME, {
      connection: this.redisService.getClient(),
    });
  }

  async getTimezoneByCoordinates(query: TimezoneRequest): Promise<TimezoneResponse> {
    const cacheKey = buildCacheKey('timezone:coords', [query], true);
    const cachedResponse = await this.redisService.get<TimezoneResponse>(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return cachedResponse;
    }

    const job = await this.bullmqService.addJob(
      this.QUEUE_NAME,
      'fetch-timezone-coords',
      query,
      {
        priority: 1 // TODO: This will change later likely
      }
    )
    return  this.waitForJobCompletion(job, cacheKey);
  }

  async getTimezoneByCity(query: TimezoneRequest): Promise<TimezoneResponse> {
    const cacheKey = buildCacheKey('timezone:city', [query], true);
    const cachedResponse = await this.redisService.get<TimezoneResponse>(cacheKey);
    if (cachedResponse) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return cachedResponse;
    }

    const job = await this.bullmqService.addJob(
      this.QUEUE_NAME,
      'fetch-timezone-city',
      query,
      {
        priority: 2 // TODO: This will change later likely
      }
    )
    return  this.waitForJobCompletion(job, cacheKey);
  }

  //Temporary method to handle job completion and caching
  private async waitForJobCompletion(
    job: Job,
    cacheKey: string
  ): Promise<TimezoneResponse> {
    const result = await job.waitUntilFinished(
      this.queueEvents,
      30000
    );

    // Cache the result
    if (result) {
      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    }

    return result;
  }

  async onModuleDestroy() {
    await this.queueEvents.close();
  }

  async getQueueStats() {
    const waiting = await this.timezoneQueue.getWaiting();
    const completed = await this.timezoneQueue.getCompleted();
    const failed = await this.timezoneQueue.getFailed();

    return {
      waiting: waiting.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

}



import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, RequestTimeoutException } from '@nestjs/common';
import { BullMQService } from '@trip-planner/bullmq';
import { RedisService } from '@trip-planner/redis';
import { Job, Queue, QueueEvents } from 'bullmq';
import { TimezoneRequest, TimezoneResponse } from '@trip-planner/types';
import { buildCacheKey } from '@trip-planner/utils';

@Injectable()
export class TimezoneService implements OnModuleInit, OnModuleDestroy {
  private timezoneQueue!: Queue;
  private queueEvents!: QueueEvents;

  private readonly CACHE_TTL = 7 * 24 * 60 * 60;
  private readonly logger = new Logger(TimezoneService.name);
  private readonly QUEUE_NAME = 'timezone-requests';


  constructor(
    private readonly bullmqService: BullMQService,
    private readonly redisService: RedisService,
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
    // Remove requestId from query to avoid cache key issues
    const { requestId, ...queryWithoutRequestId } = query;
    const cacheKey = buildCacheKey('timezone:coords', [queryWithoutRequestId], true);
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
    const response = await this.waitForJobCompletion(job, cacheKey);
    await this.redisService.set(cacheKey, response, this.CACHE_TTL);
    return response;
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
    try {
      const result = await job.waitUntilFinished(
        this.queueEvents,
        30000
      );

      if (!result) {
        this.logger.error(`Job ${job.id} completed but returned no result`);
      }

      // Cache the result
      await this.redisService.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed or timed out:`, error);
      if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
        throw new RequestTimeoutException('Timezone lookup request timed out');
      }
      throw new ServiceUnavailableException('Timezone service is currently unavailable');
    }
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



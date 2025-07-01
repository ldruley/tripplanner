import { Injectable, InternalServerErrorException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job, QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

export interface BullMQConfig {
  redis: {
    host: string;
    port: number;
    db?: number;
  };
}

export interface QueueConfig extends Partial<QueueOptions> {
  name: string;
}

export interface WorkerConfig<T = unknown> extends Partial<WorkerOptions> {
  name: string;
  processor: (job: Job<T>) => Promise<unknown>;
}

@Injectable()
export class BullMQService implements OnModuleInit, OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly redisConnection: Redis;

  constructor() {
    // Use same Redis connection as your existing RedisService
    this.redisConnection = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: Number(process.env['REDIS_PORT']) || 6379,
      db: Number(process.env['REDIS_DB']) || 0,
      maxRetriesPerRequest: null, // Important for BullMQ
      enableReadyCheck: false,
    });
  }

  async onModuleInit() {
    console.log('BullMQ Service initialized');
  }

  async onModuleDestroy() {
    // Gracefully close all workers and queues
    await Promise.all([
      ...Array.from(this.workers.values()).map(worker => worker.close()),
      ...Array.from(this.queues.values()).map(queue => queue.close()),
    ]);
    await this.redisConnection.quit();
  }

  /**
   * Create or get a queue
   */
  createQueue(config: QueueConfig): Queue {
    if (this.queues.has(config.name)) {
      const queue = this.queues.get(config.name);
      if (!queue) {
        throw new InternalServerErrorException(`Queue with name ${config.name} does not exist`);
      }
      return queue;
    }

    const queue = new Queue(config.name, {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...config,
    });

    this.queues.set(config.name, queue);
    return queue;
  }

  /**
   * Create a worker for processing jobs
   */
  createWorker<T = unknown>(config: WorkerConfig<T>): Worker<T> {
    if (this.workers.has(config.name)) {
      const worker = this.workers.get(config.name);
      if (!worker) {
        throw new InternalServerErrorException(`Worker with name ${config.name} does not exist`);
      }
      return worker;
    }

    const worker = new Worker(
      config.name,
      async (job: Job<T>) => {
        try {
          return await config.processor(job);
        } catch (error) {
          console.error(`Worker ${config.name} job ${job.id} failed:`, error);
          throw error;
        }
      },
      {
        connection: this.redisConnection,
        concurrency: 1, // Default to 1 for rate limiting
        ...config,
      }
    );

    // Add event listeners for monitoring
    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed in queue ${config.name}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed in queue ${config.name}:`, err);
    });

    this.workers.set(config.name, worker);
    return worker;
  }

  /**
   * Get an existing queue
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Get an existing worker
   */
  getWorker<T = unknown>(name: string): Worker<T> | undefined {
    return this.workers.get(name);
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found. Create it first with createQueue()`);
    }

    return queue.add(jobName, data, options);
  }
}

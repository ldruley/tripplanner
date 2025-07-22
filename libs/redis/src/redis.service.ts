import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ValidationConfigService } from '@trip-planner/config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly configService: ValidationConfigService) {
    const redisConfig = this.configService.getRedisConnectionOptions();
    
    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      maxRetriesPerRequest: null,
    };

    this.client = new Redis(options);
  }

  onModuleInit() {
    console.log('Redis connected');
  }

  onModuleDestroy() {
    this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async getOrSet<T = unknown>(key: string, ttlSec: number, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetchFn();
    await this.set(key, fresh, ttlSec);
    return fresh;
  }

  async set(key: string, value: unknown, ttlSec?: number) {
    const str = JSON.stringify(value);
    if (ttlSec) {
      await this.client.set(key, str, 'EX', ttlSec);
    } else {
      await this.client.set(key, str);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }
}

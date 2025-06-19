import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor() {
    const options: RedisOptions = {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: Number(process.env['REDIS_PORT']) || 6379,
      db: Number(process.env['REDIS_DB']) || 0,
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

  async set(key: string, value: any, ttlSec?: number) {
    const str = JSON.stringify(value);
    if (ttlSec) {
      await this.client.set(key, str, 'EX', ttlSec);
    } else {
      await this.client.set(key, str);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const result = await this.client.get(key);
    return result ? JSON.parse(result) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }
}

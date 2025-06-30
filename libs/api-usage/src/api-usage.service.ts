import { Injectable, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@trip-planner/redis';
import { Redis } from 'ioredis';
import { QuotaService } from '@trip-planner/quota';

type Provider = 'here' | 'mapbox' | 'google';
type Action = 'geocoding' | 'routing' | 'matrix-routing' | 'poi';

@Injectable()
export class ApiUsageService implements OnModuleInit {
  private redisClient!: Redis;
  private luaScriptSha!: string;

  constructor (
    private readonly redisService: RedisService,
    private readonly quotaService: QuotaService
  ) {}

  async onModuleInit() {
    this.redisClient = this.redisService.getClient();

    const script = `
      local c = redis.call('INCR', KEYS[1])
      return c
    `;

    this.luaScriptSha = await this.redisClient.script('LOAD', script) as string;
  }

  private makeKey(
    provider: Provider,
    action: Action,
    endpoint?: string,
    date: Date = new Date()
  ): string {
    const month = date.toISOString().slice(0, 7); // ex. 2025-06
    const suffix = endpoint ? `${action}.${endpoint}` : action;
    return `usage:${month}:${provider}:${suffix}`;
  }

  /**
   * Atomically increment usage for a given provider/action/endpoint combo
   */
  async increment(
    provider: Provider,
    action: Action,
    endpoint?: string
  ): Promise<number> {
    const key = this.makeKey(provider, action, endpoint);
    return (await this.redisClient.evalsha(this.luaScriptSha, 1, key)) as number; // this should always return a number
  }

  /**
   * Retrieve current usage count for this calendar month
   */
  async getCurrent(
    provider: Provider,
    action: Action,
    endpoint?: string
  ): Promise<number> {
    const key = this.makeKey(provider, action, endpoint);
    const val = await this.redisClient.get(key);
    return Number(val ?? 0);
  }

  async checkQuota(
    provider: Provider,
    action: Action,
    endpoint?: string,
  ): Promise<boolean> {
    const quota = this.quotaService.getQuota(provider, action, endpoint);
    const currentUsage = await this.getCurrent(provider, action, endpoint);
    //TODO: Better strategy for handling undefined quotas
    return currentUsage < (quota !== null && quota !== undefined ? quota : Number.MAX_SAFE_INTEGER) ;
  }
}

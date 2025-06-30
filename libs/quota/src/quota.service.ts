import z from 'zod';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as YAML from 'yaml';
import * as fs from 'fs';
import * as path from 'node:path';

const EndpointQuotaSchema = z.object({
  monthly: z.number(),
});

const ActionQuotaSchema = z.object({
  monthly: z.number().optional(),
  endpoints: z.record(z.string(), EndpointQuotaSchema).optional(),
});

const ProviderQuotaSchema = z.record(z.string(), ActionQuotaSchema);

const QuotaConfigSchema = z.object({
  quotas: z.record(z.string(), ProviderQuotaSchema),
});

export type QuotaConfig = z.infer<typeof QuotaConfigSchema>;

@Injectable()
export class QuotaService implements OnModuleInit {
  private config!: QuotaConfig;

  onModuleInit() {
    const filePath = path.resolve(process.cwd(), 'config/api-quotas.yaml');
    const file = fs.readFileSync(filePath, 'utf8');
    const config = YAML.parse(file);
    this.config = QuotaConfigSchema.parse(config);
  }

  getQuota(provider: string, action: string, endpoint?: string): number | null {
    const base = this.config.quotas?.[provider]?.[action];
    if (!base) return null;

    if (endpoint && base.endpoints?.[endpoint]?.monthly) {
      return base.endpoints[endpoint].monthly;
    }

    return base.monthly ?? null;
  }
}

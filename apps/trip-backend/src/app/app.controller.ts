import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from '@trip-planner/prisma';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService
) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  @Get('health/db')
  async checkDatabaseHealth() {
    const isHealthy = await this.databaseService.isHealthy();
    return {
      database: isHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/profiles')
  async checkProfiles() {
    try {
      const client = this.databaseService.getClient();
      const profileCount = await client.profiles.count();
      return {
        profilesTable: 'accessible',
        count: profileCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        profilesTable: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

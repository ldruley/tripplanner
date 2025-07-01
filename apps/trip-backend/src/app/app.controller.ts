import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from '../../../../libs/shared/prisma/src';

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

  /*
  * Health check for the profiles table in the database.
  *
  * @remarks Checks if the profiles table is accessible and returns the count of profiles.
  * @example ['1', '2', '3']
  * */
  @Get('health/profiles')
  async checkProfiles() {
    try {
      const client = this.databaseService.getClient();
      const profileCount = await client.profile.count();
      return {
        profilesTable: 'accessible',
        count: profileCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        profilesTable: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

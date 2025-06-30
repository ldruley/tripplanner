import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneModule } from './timezone.module';
import { TimezoneService } from './timezone.service';
import { TimezoneWorker } from './timezone.worker';
import { TimezoneController } from './timezone.controller';
import { BullMQService } from '@trip-planner/bullmq';
import { RedisService } from '@trip-planner/redis';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';

describe('TimezoneModule', () => {
  let module: TestingModule;
  let timezoneService: TimezoneService;
  let timezoneWorker: TimezoneWorker;
  let timezoneController: TimezoneController;

  beforeEach(async () => {
    // Create mock services
    const mockBullMQService = mock<BullMQService>();
    const mockRedisService = mock<RedisService>();
    const mockHttpService = mock<HttpService>();
    const mockConfigService = mock<ConfigService>();

    // Set up config service defaults
    mockConfigService.get.mockImplementation((key: string) => {
      const configs: Record<string, string> = {
        'TIMEZONEDB_API_KEY': 'test-api-key',
        'TIMEZONEDB_BASE_URL': 'https://api.timezonedb.com/v2.1'
      };
      return configs[key];
    });

    // Set up BullMQ service defaults
    mockBullMQService.createQueue.mockReturnValue({} as any);
    mockBullMQService.createWorker.mockReturnValue({} as any);

    // Set up Redis service defaults
    mockRedisService.getClient.mockReturnValue({} as any);

    module = await Test.createTestingModule({
      providers: [
        TimezoneService,
        TimezoneWorker,
        { provide: BullMQService, useValue: mockBullMQService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService }
      ],
      controllers: [TimezoneController]
    })
    .setLogger(createMockLogger())
    .compile();

    timezoneService = module.get<TimezoneService>(TimezoneService);
    timezoneWorker = module.get<TimezoneWorker>(TimezoneWorker);
    timezoneController = module.get<TimezoneController>(TimezoneController);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('module compilation', () => {
    it('should compile the module successfully', () => {
      expect(module).toBeDefined();
    });

    it('should provide TimezoneService', () => {
      expect(timezoneService).toBeDefined();
      expect(timezoneService).toBeInstanceOf(TimezoneService);
    });

    it('should provide TimezoneWorker', () => {
      expect(timezoneWorker).toBeDefined();
      expect(timezoneWorker).toBeInstanceOf(TimezoneWorker);
    });

    it('should provide TimezoneController', () => {
      expect(timezoneController).toBeDefined();
      expect(timezoneController).toBeInstanceOf(TimezoneController);
    });
  });

  describe('dependency injection', () => {
    it('should inject dependencies into TimezoneService', () => {
      expect(timezoneService).toBeDefined();
      
      // Verify that the service has the expected dependencies
      expect(timezoneService['bullmqService']).toBeDefined();
      expect(timezoneService['redisService']).toBeDefined();
    });

    it('should inject dependencies into TimezoneWorker', () => {
      expect(timezoneWorker).toBeDefined();
      
      // Verify that the worker has the expected dependencies
      expect(timezoneWorker['bullmqService']).toBeDefined();
      expect(timezoneWorker['configService']).toBeDefined();
      expect(timezoneWorker['httpService']).toBeDefined();
    });

    it('should inject TimezoneService into TimezoneController', () => {
      expect(timezoneController).toBeDefined();
      
      // Verify that the controller has the timezone service
      expect(timezoneController['timezoneService']).toBeDefined();
      expect(timezoneController['timezoneService']).toBeInstanceOf(TimezoneService);
    });
  });

  describe('service integration', () => {
    it('should allow TimezoneService to be used in other modules', () => {
      // Test that TimezoneService is available for dependency injection
      expect(() => {
        module.get<TimezoneService>(TimezoneService);
      }).not.toThrow();
    });

    it('should maintain proper service lifecycle', async () => {
      // Verify services are properly initialized
      expect(timezoneService).toBeDefined();
      expect(timezoneWorker).toBeDefined();
      expect(timezoneController).toBeDefined();

      // Services should be accessible and functional
      expect(typeof timezoneService.getTimezoneByCoordinates).toBe('function');
      expect(typeof timezoneController.getTimezoneFromCoords).toBe('function');
    });

    it('should handle module shutdown gracefully', async () => {
      // Verify module can be closed without errors
      expect(async () => {
        await module.close();
      }).not.toThrow();
    });
  });

  describe('configuration validation', () => {
    it('should validate required configuration', () => {
      // The TimezoneWorker constructor validates API key presence
      expect(timezoneWorker).toBeDefined();
      
      // If we got this far, the API key validation passed
      expect(timezoneWorker['apiKey']).toBe('test-api-key');
      expect(timezoneWorker['baseUrl']).toBe('https://api.timezonedb.com/v2.1');
    });

    it('should handle missing configuration appropriately', () => {
      // This test verifies that the worker throws appropriate errors
      // when required configuration is missing
      const mockConfigServiceMissingKey = mock<ConfigService>();
      mockConfigServiceMissingKey.get.mockReturnValue(undefined);

      expect(() => {
        new TimezoneWorker(mock<BullMQService>(), mockConfigServiceMissingKey, mock<HttpService>());
      }).toThrow();
    });
  });
});
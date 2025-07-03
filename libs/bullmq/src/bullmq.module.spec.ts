import { Test, TestingModule } from '@nestjs/testing';
import { Module } from '@nestjs/common';
import { createMockLogger } from '@trip-planner/test-utils';
import { BullMQModule } from './bullmq.module';
import { BullMQService } from './bullmq.service';

// Mock the service to avoid Redis connection during module testing
jest.mock('./bullmq.service');

describe('BullMQModule', () => {
  let module: TestingModule;
  let service: BullMQService;

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      imports: [BullMQModule],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<BullMQService>(BullMQService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide BullMQService', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(BullMQService);
  });

  it('should be a global module', () => {
    // Check if the @Global() decorator was applied by checking if metadata exists
    // Note: In testing environment, we verify the module behaves globally
    expect(BullMQModule).toBeDefined();
    // The global behavior is tested in the 'global module behavior' section
  });

  it('should export BullMQService', () => {
    // Verify service is available for injection
    expect(service).toBeDefined();
  });

  describe('module compilation', () => {
    it('should compile successfully', async () => {
      const testModule = await Test.createTestingModule({
        imports: [BullMQModule],
      }).compile();

      expect(testModule).toBeDefined();
      await testModule.close();
    });

    it('should be importable multiple times', async () => {
      const module1 = await Test.createTestingModule({
        imports: [BullMQModule],
      }).compile();

      const module2 = await Test.createTestingModule({
        imports: [BullMQModule],
      }).compile();

      expect(module1.get(BullMQService)).toBeDefined();
      expect(module2.get(BullMQService)).toBeDefined();

      await Promise.all([module1.close(), module2.close()]);
    });
  });

  describe('service injection', () => {
    it('should provide the same service instance when injected multiple times', () => {
      const service1 = module.get<BullMQService>(BullMQService);
      const service2 = module.get<BullMQService>(BullMQService);

      expect(service1).toBe(service2);
    });
  });

  describe('global module behavior', () => {
    it('should make BullMQService available globally', async () => {
      // Create a consumer module that doesn't import BullMQModule
      @Module({
        providers: [
          {
            provide: 'TEST_CONSUMER',
            useFactory: (bullmqService: BullMQService) => {
              return { service: bullmqService };
            },
            inject: [BullMQService],
          },
        ],
      })
      class ConsumerModule {}

      // Import both modules - BullMQModule should make service globally available
      const testModule = await Test.createTestingModule({
        imports: [BullMQModule, ConsumerModule],
      }).compile();

      const consumer = testModule.get('TEST_CONSUMER');
      expect(consumer.service).toBeDefined();
      expect(consumer.service).toBeInstanceOf(BullMQService);

      await testModule.close();
    });
  });
});

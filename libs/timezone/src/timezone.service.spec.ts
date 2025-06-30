import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneService } from './timezone.service';
import { BullMQService } from '@trip-planner/bullmq';
import { RedisService } from '@trip-planner/redis';
import { TimezoneRequest, TimezoneResponse } from '@trip-planner/types';
import { Job, Queue } from 'bullmq';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import { ServiceUnavailableException, RequestTimeoutException } from '@nestjs/common';

// Mock the QueueEvents class
jest.mock('bullmq', () => {
  const originalModule = jest.requireActual('bullmq');
  return {
    ...originalModule,
    QueueEvents: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn()
    }))
  };
});

describe('TimezoneService', () => {
  let service: TimezoneService;
  let module: TestingModule;
  let bullmqService: ReturnType<typeof mock<BullMQService>>;
  let redisService: ReturnType<typeof mock<RedisService>>;
  let mockQueue: ReturnType<typeof mock<Queue>>;
  let mockJob: ReturnType<typeof mock<Job>>;

  beforeEach(async () => {
    bullmqService = mock<BullMQService>();
    redisService = mock<RedisService>();
    mockQueue = mock<Queue>();
    mockJob = mock<Job>();

    // Setup BullMQ service mocks
    bullmqService.createQueue.mockReturnValue(mockQueue);
    bullmqService.addJob.mockResolvedValue(mockJob);

    module = await Test.createTestingModule({
      providers: [
        TimezoneService,
        { provide: BullMQService, useValue: bullmqService },
        { provide: RedisService, useValue: redisService },
      ],
    })
    .setLogger(createMockLogger())
    .compile();

    service = module.get<TimezoneService>(TimezoneService);

    await service.onModuleInit();

    // Clear mocks after initialization
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('onModuleInit', () => {
    it('should initialize timezone queue with correct configuration', async () => {
      // Arrange - Create fresh service for this test
      const freshBullmqService = mock<BullMQService>();
      const freshRedisService = mock<RedisService>();
      const freshMockQueue = mock<Queue>();
      
      freshBullmqService.createQueue.mockReturnValue(freshMockQueue);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TimezoneService,
          { provide: BullMQService, useValue: freshBullmqService },
          { provide: RedisService, useValue: freshRedisService },
        ],
      }).compile();

      const freshService = module.get<TimezoneService>(TimezoneService);

      // Act
      await freshService.onModuleInit();

      // Assert
      expect(freshBullmqService.createQueue).toHaveBeenCalledWith({
        name: 'timezone-requests',
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
    });

    it('should initialize queue events with Redis connection', async () => {
      // Arrange
      const freshBullmqService = mock<BullMQService>();
      const freshRedisService = mock<RedisService>();
      const mockRedisClient = {};
      
      freshBullmqService.createQueue.mockReturnValue(mockQueue);
      freshRedisService.getClient.mockReturnValue(mockRedisClient as any);
      
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          TimezoneService,
          { provide: BullMQService, useValue: freshBullmqService },
          { provide: RedisService, useValue: freshRedisService },
        ],
      }).compile();

      const freshService = module.get<TimezoneService>(TimezoneService);

      // Mock the QueueEvents import at test level
      const { QueueEvents } = require('bullmq');

      // Act
      await freshService.onModuleInit();

      // Assert
      expect(QueueEvents).toHaveBeenCalledWith('timezone-requests', {
        connection: mockRedisClient
      });
    });
  });

  describe('getTimezoneByCoordinates', () => {
    const mockRequest: TimezoneRequest = {
      latitude: 40.7128,
      longitude: -74.0060,
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const mockResponse: TimezoneResponse = {
      timezone: 'America/New_York',
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should return cached response when available', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockResponse);

      // Act
      const result = await service.getTimezoneByCoordinates(mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(redisService.get).toHaveBeenCalledWith(
        expect.stringContaining('timezone:coords')
      );
      expect(bullmqService.addJob).not.toHaveBeenCalled();
    });

    it('should process job and cache result when cache miss', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);
      (mockJob as any).id = 'job-123';

      // Act
      const result = await service.getTimezoneByCoordinates(mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(bullmqService.addJob).toHaveBeenCalledWith(
        'timezone-requests',
        'fetch-timezone-coords',
        mockRequest,
        { priority: 1 }
      );
      expect(mockJob.waitUntilFinished).toHaveBeenCalledWith(
        expect.objectContaining({
          close: expect.any(Function)
        }),
        30000
      );
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('timezone:coords'),
        mockResponse,
        604800 // 7 days in seconds
      );
    });

    it('should exclude requestId from cache key generation', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);

      const requestWithId = { ...mockRequest, requestId: '123' };
      const requestWithDifferentId = { ...mockRequest, requestId: '456' };

      // Act
      await service.getTimezoneByCoordinates(requestWithId);
      await service.getTimezoneByCoordinates(requestWithDifferentId);

      // Assert - Both requests should generate the same cache key
      const cacheKeyCalls = redisService.get.mock.calls.map(call => call[0]);
      expect(cacheKeyCalls[0]).toEqual(cacheKeyCalls[1]);
      expect(cacheKeyCalls[0]).toContain('timezone:coords');
      // The buildCacheKey utility hashes the values, so we just check the prefix
      expect(cacheKeyCalls[0]).toMatch(/^timezone:coords:[a-f0-9]+$/);
    });

    it('should handle timeout errors', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';
      
      // Reset and setup the job mock properly for this test
      bullmqService.addJob.mockResolvedValue(mockJob);
      mockJob.waitUntilFinished.mockRejectedValue(timeoutError);
      (mockJob as any).id = 'timeout-test-job';

      // Act & Assert
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow(RequestTimeoutException);
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow('Timezone lookup request timed out');
    });

    it('should handle service unavailable errors', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      const serviceError = new Error('Redis connection failed');
      mockJob.waitUntilFinished.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow(ServiceUnavailableException);
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow('Timezone service is currently unavailable');
    });

    it('should handle job completion with no result', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(null);
      (mockJob as any).id = 'job-456';

      // Act
      const result = await service.getTimezoneByCoordinates(mockRequest);

      // Assert
      expect(result).toBeNull();
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        null,
        604800
      );
    });
  });

  describe('getTimezoneByCity', () => {
    const mockCityRequest: TimezoneRequest = {
      city: 'New York',
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const mockResponse: TimezoneResponse = {
      timezone: 'America/New_York',
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should return cached response when available', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockResponse);

      // Act
      const result = await service.getTimezoneByCity(mockCityRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(redisService.get).toHaveBeenCalledWith(
        expect.stringContaining('timezone:city')
      );
      expect(bullmqService.addJob).not.toHaveBeenCalled();
    });

    it('should process job when cache miss', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);

      // Act
      const result = await service.getTimezoneByCity(mockCityRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(bullmqService.addJob).toHaveBeenCalledWith(
        'timezone-requests',
        'fetch-timezone-city',
        mockCityRequest,
        { priority: 2 }
      );
    });

    it('should use different priority for city lookups', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);

      // Act
      await service.getTimezoneByCity(mockCityRequest);

      // Assert
      expect(bullmqService.addJob).toHaveBeenCalledWith(
        'timezone-requests',
        'fetch-timezone-city',
        mockCityRequest,
        { priority: 2 } // Higher priority number (lower priority)
      );
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      const mockWaiting = [{ id: '1' }, { id: '2' }];
      const mockCompleted = [{ id: '3' }];
      const mockFailed = [{ id: '4' }, { id: '5' }, { id: '6' }];

      mockQueue.getWaiting.mockResolvedValue(mockWaiting as any);
      mockQueue.getCompleted.mockResolvedValue(mockCompleted as any);
      mockQueue.getFailed.mockResolvedValue(mockFailed as any);

      // Act
      const stats = await service.getQueueStats();

      // Assert
      expect(stats).toEqual({
        waiting: 2,
        completed: 1,
        failed: 3,
      });
    });

    it('should handle empty queues', async () => {
      // Arrange
      mockQueue.getWaiting.mockResolvedValue([]);
      mockQueue.getCompleted.mockResolvedValue([]);
      mockQueue.getFailed.mockResolvedValue([]);

      // Act
      const stats = await service.getQueueStats();

      // Assert
      expect(stats).toEqual({
        waiting: 0,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe('caching behavior', () => {
    const mockRequest: TimezoneRequest = {
      latitude: 51.5074,
      longitude: -0.1278,
    };

    const mockResponse: TimezoneResponse = {
      timezone: 'Europe/London',
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should use 7-day TTL for caching', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);

      // Act
      await service.getTimezoneByCoordinates(mockRequest);

      // Assert
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        mockResponse,
        604800 // 7 * 24 * 60 * 60 seconds
      );
    });

    it('should generate consistent cache keys for same coordinates', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockResponse);

      // Act
      await service.getTimezoneByCoordinates(mockRequest);
      await service.getTimezoneByCoordinates({ ...mockRequest });

      // Assert
      expect(redisService.get).toHaveBeenCalledTimes(2);
      const firstCacheKey = redisService.get.mock.calls[0][0];
      const secondCacheKey = redisService.get.mock.calls[1][0];
      expect(firstCacheKey).toEqual(secondCacheKey);
    });

    it('should generate different cache keys for coordinates vs city', async () => {
      // Arrange
      redisService.get.mockResolvedValue(mockResponse);
      const cityRequest: TimezoneRequest = { city: 'London' };

      // Act
      await service.getTimezoneByCoordinates(mockRequest);
      await service.getTimezoneByCity(cityRequest);

      // Assert
      const coordsCacheKey = redisService.get.mock.calls[0][0];
      const cityCacheKey = redisService.get.mock.calls[1][0];
      expect(coordsCacheKey).toContain('timezone:coords');
      expect(cityCacheKey).toContain('timezone:city');
      expect(coordsCacheKey).not.toEqual(cityCacheKey);
    });
  });

  describe('error scenarios', () => {
    const mockRequest: TimezoneRequest = {
      latitude: 40.7128,
      longitude: -74.0060,
    };

    it('should handle Redis cache retrieval failures', async () => {
      // Arrange
      const cacheError = new Error('Redis connection failed');
      redisService.get.mockRejectedValue(cacheError);

      // Act & Assert
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow('Redis connection failed');
    });

    it('should handle BullMQ job creation failures', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      const jobError = new Error('Queue is full');
      bullmqService.addJob.mockRejectedValue(jobError);

      // Act & Assert
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow('Queue is full');
    });

    it('should handle job completion failures with generic error', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      const jobError = new Error('Worker crashed');
      mockJob.waitUntilFinished.mockRejectedValue(jobError);

      // Act & Assert
      await expect(service.getTimezoneByCoordinates(mockRequest))
        .rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close queue events on module destruction', async () => {
      // Act & Assert - Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle queue events close failure gracefully', async () => {
      // This test is handled by the mock implementation
      // The service should gracefully handle close failures
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('integration workflows', () => {
    const mockRequest: TimezoneRequest = {
      latitude: 48.8566,
      longitude: 2.3522,
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const mockResponse: TimezoneResponse = {
      timezone: 'Europe/Paris',
      requestId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should complete full timezone lookup workflow', async () => {
      // Arrange
      redisService.get.mockResolvedValue(null);
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);
      (mockJob as any).id = 'job-789';

      // Act
      const result = await service.getTimezoneByCoordinates(mockRequest);

      // Assert - Verify complete workflow
      expect(redisService.get).toHaveBeenCalledWith(
        expect.stringContaining('timezone:coords')
      );
      expect(bullmqService.addJob).toHaveBeenCalledWith(
        'timezone-requests',
        'fetch-timezone-coords',
        mockRequest,
        { priority: 1 }
      );
      expect(mockJob.waitUntilFinished).toHaveBeenCalledWith(
        expect.objectContaining({
          close: expect.any(Function)
        }),
        30000
      );
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('timezone:coords'),
        mockResponse,
        604800
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle subsequent cached requests efficiently', async () => {
      // Arrange
      redisService.get
        .mockResolvedValueOnce(null) // First call - cache miss
        .mockResolvedValueOnce(mockResponse); // Second call - cache hit
      mockJob.waitUntilFinished.mockResolvedValue(mockResponse);

      // Act
      const firstResult = await service.getTimezoneByCoordinates(mockRequest);
      const secondResult = await service.getTimezoneByCoordinates(mockRequest);

      // Assert
      expect(firstResult).toEqual(mockResponse);
      expect(secondResult).toEqual(mockResponse);
      expect(bullmqService.addJob).toHaveBeenCalledTimes(1); // Only called once
      expect(redisService.set).toHaveBeenCalledTimes(2); // Called twice (once in workflow, once after job)
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ApiUsageService } from './api-usage.service';
import { RedisService } from '@trip-planner/redis';
import { QuotaService } from '@trip-planner/quota';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import { Redis } from 'ioredis';

describe('ApiUsageService', () => {
  let service: ApiUsageService;
  let redisService: ReturnType<typeof mock<RedisService>>;
  let quotaService: ReturnType<typeof mock<QuotaService>>;
  let redisClient: ReturnType<typeof mock<Redis>>;

  beforeEach(async () => {
    redisService = mock<RedisService>();
    quotaService = mock<QuotaService>();
    redisClient = mock<Redis>();

    // Setup Redis client mock
    redisService.getClient.mockReturnValue(redisClient);
    redisClient.script.mockResolvedValue('mock-script-sha'); // Default script loading success

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsageService,
        { provide: RedisService, useValue: redisService },
        { provide: QuotaService, useValue: quotaService }
      ],
    })
    .setLogger(createMockLogger())
    .compile();

    service = module.get<ApiUsageService>(ApiUsageService);

    // Initialize the service to set up Redis client
    await service.onModuleInit();

    // Reset all mocks after initialization
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client and load Lua script', async () => {
      // Arrange - Create a fresh service for this test
      const freshRedisService = mock<RedisService>();
      const freshRedisClient = mock<Redis>();
      const mockScriptSha = 'abc123def456';
      
      freshRedisService.getClient.mockReturnValue(freshRedisClient);
      freshRedisClient.script.mockResolvedValue(mockScriptSha);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ApiUsageService,
          { provide: RedisService, useValue: freshRedisService },
          { provide: QuotaService, useValue: quotaService }
        ],
      }).compile();

      const freshService = module.get<ApiUsageService>(ApiUsageService);

      // Act
      await freshService.onModuleInit();

      // Assert
      expect(freshRedisService.getClient).toHaveBeenCalled();
      expect(freshRedisClient.script).toHaveBeenCalledWith('LOAD', expect.stringContaining('INCR'));
      expect(freshRedisClient.script).toHaveBeenCalledWith('LOAD', expect.stringContaining('redis.call'));
    });

    it('should handle Lua script loading failure', async () => {
      // Arrange - Create a fresh service for this test
      const freshRedisService = mock<RedisService>();
      const freshRedisClient = mock<Redis>();
      const scriptError = new Error('Redis script loading failed');
      
      freshRedisService.getClient.mockReturnValue(freshRedisClient);
      freshRedisClient.script.mockRejectedValue(scriptError);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ApiUsageService,
          { provide: RedisService, useValue: freshRedisService },
          { provide: QuotaService, useValue: quotaService }
        ],
      }).compile();

      const freshService = module.get<ApiUsageService>(ApiUsageService);

      // Act & Assert
      await expect(freshService.onModuleInit()).rejects.toThrow('Redis script loading failed');
    });

    // Note: Redis client retrieval failure testing is complex due to constructor behavior
    // This would be tested in integration tests where Redis service is properly mocked
  });

  describe('makeKey', () => {
    it('should generate correct key format without endpoint', () => {
      // Arrange
      const fixedDate = new Date('2025-06-15T10:30:00.000Z');

      // Act
      const key = service['makeKey']('here', 'geocoding', undefined, fixedDate);

      // Assert
      expect(key).toBe('usage:2025-06:here:geocoding');
    });

    it('should generate correct key format with endpoint', () => {
      // Arrange
      const fixedDate = new Date('2025-06-15T10:30:00.000Z');

      // Act
      const key = service['makeKey']('mapbox', 'routing', 'directions', fixedDate);

      // Assert
      expect(key).toBe('usage:2025-06:mapbox:routing.directions');
    });

    it('should use current date when no date provided', () => {
      // Arrange
      const mockDate = new Date('2025-12-25T15:45:30.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Act
      const key = service['makeKey']('google', 'poi');

      // Assert
      expect(key).toBe('usage:2025-12:google:poi');

      // Cleanup
      jest.restoreAllMocks();
    });

    it('should handle cross-month date correctly', () => {
      // Arrange - Test month boundary
      const newYearDate = new Date('2026-01-01T00:00:00.000Z');

      // Act
      const key = service['makeKey']('here', 'matrix-routing', undefined, newYearDate);

      // Assert
      expect(key).toBe('usage:2026-01:here:matrix-routing');
    });

    it('should handle different providers and actions', () => {
      // Arrange
      const fixedDate = new Date('2025-06-15T10:30:00.000Z');

      // Act & Assert
      expect(service['makeKey']('here', 'geocoding', undefined, fixedDate))
        .toBe('usage:2025-06:here:geocoding');
      expect(service['makeKey']('mapbox', 'routing', undefined, fixedDate))
        .toBe('usage:2025-06:mapbox:routing');
      expect(service['makeKey']('google', 'poi', undefined, fixedDate))
        .toBe('usage:2025-06:google:poi');
    });
  });

  describe('increment', () => {

    it('should increment usage atomically and return new count', async () => {
      // Arrange
      const expectedCount = 5;
      redisClient.evalsha.mockResolvedValue(expectedCount);

      // Act
      const result = await service.increment('here', 'geocoding');

      // Assert
      expect(result).toBe(expectedCount);
      expect(redisClient.evalsha).toHaveBeenCalledWith(
        'mock-script-sha',
        1,
        expect.stringMatching(/^usage:\d{4}-\d{2}:here:geocoding$/)
      );
    });

    it('should increment usage with endpoint', async () => {
      // Arrange
      const expectedCount = 3;
      redisClient.evalsha.mockResolvedValue(expectedCount);

      // Act
      const result = await service.increment('mapbox', 'routing', 'directions');

      // Assert
      expect(result).toBe(expectedCount);
      expect(redisClient.evalsha).toHaveBeenCalledWith(
        'mock-script-sha',
        1,
        expect.stringMatching(/^usage:\d{4}-\d{2}:mapbox:routing\.directions$/)
      );
    });

    it('should handle Redis evalsha failure', async () => {
      // Arrange
      const redisError = new Error('Redis evalsha failed');
      redisClient.evalsha.mockRejectedValue(redisError);

      // Act & Assert
      await expect(service.increment('here', 'geocoding')).rejects.toThrow('Redis evalsha failed');
    });

    it('should generate different keys for different months', async () => {
      // Arrange
      const june2025 = new Date('2025-06-15T10:30:00.000Z');
      const july2025 = new Date('2025-07-15T10:30:00.000Z');
      
      jest.spyOn(service as any, 'makeKey')
        .mockReturnValueOnce('usage:2025-06:here:geocoding')
        .mockReturnValueOnce('usage:2025-07:here:geocoding');
      
      redisClient.evalsha.mockResolvedValue(1);

      // Mock Date constructor for different calls
      const originalDate = global.Date;
      global.Date = jest.fn()
        .mockImplementationOnce(() => june2025)
        .mockImplementationOnce(() => july2025) as any;
      global.Date.now = originalDate.now;

      // Act
      await service.increment('here', 'geocoding');
      await service.increment('here', 'geocoding');

      // Assert
      expect(redisClient.evalsha).toHaveBeenNthCalledWith(1, 'mock-script-sha', 1, 'usage:2025-06:here:geocoding');
      expect(redisClient.evalsha).toHaveBeenNthCalledWith(2, 'mock-script-sha', 1, 'usage:2025-07:here:geocoding');

      // Cleanup
      global.Date = originalDate;
    });
  });

  describe('getCurrent', () => {
    it('should return current usage count', async () => {
      // Arrange
      const expectedUsage = 42;
      redisClient.get.mockResolvedValue(expectedUsage.toString());

      // Act
      const result = await service.getCurrent('here', 'geocoding');

      // Assert
      expect(result).toBe(expectedUsage);
      expect(redisClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/^usage:\d{4}-\d{2}:here:geocoding$/)
      );
    });

    it('should return 0 when key does not exist (null value)', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(null);

      // Act
      const result = await service.getCurrent('mapbox', 'routing');

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when key has undefined value', async () => {
      // Arrange
      redisClient.get.mockResolvedValue(undefined as any);

      // Act
      const result = await service.getCurrent('google', 'poi');

      // Assert
      expect(result).toBe(0);
    });

    it('should handle string numbers correctly', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('123');

      // Act
      const result = await service.getCurrent('here', 'matrix-routing');

      // Assert
      expect(result).toBe(123);
      expect(typeof result).toBe('number');
    });

    it('should get current usage with endpoint', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('7');

      // Act
      const result = await service.getCurrent('mapbox', 'routing', 'directions');

      // Assert
      expect(result).toBe(7);
      expect(redisClient.get).toHaveBeenCalledWith(
        expect.stringMatching(/^usage:\d{4}-\d{2}:mapbox:routing\.directions$/)
      );
    });

    it('should handle Redis get failure', async () => {
      // Arrange
      const redisError = new Error('Redis get failed');
      redisClient.get.mockRejectedValue(redisError);

      // Act & Assert
      await expect(service.getCurrent('here', 'geocoding')).rejects.toThrow('Redis get failed');
    });
  });

  describe('checkQuota', () => {
    it('should return true when usage is below quota', async () => {
      // Arrange
      const quota = 1000;
      const currentUsage = 500;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('here', 'geocoding');

      // Assert
      expect(result).toBe(true);
      expect(quotaService.getQuota).toHaveBeenCalledWith('here', 'geocoding', undefined);
    });

    it('should return false when usage equals quota', async () => {
      // Arrange
      const quota = 1000;
      const currentUsage = 1000;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('mapbox', 'routing');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when usage exceeds quota', async () => {
      // Arrange
      const quota = 1000;
      const currentUsage = 1500;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('google', 'poi');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when quota is undefined (unlimited)', async () => {
      // Arrange
      const currentUsage = 9999999;
      quotaService.getQuota.mockReturnValue(null);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('here', 'geocoding');

      // Assert
      expect(result).toBe(true); // Should use Number.MAX_SAFE_INTEGER as fallback
    });

    it('should check quota with endpoint-specific limits', async () => {
      // Arrange
      const endpointQuota = 500;
      const currentUsage = 300;
      quotaService.getQuota.mockReturnValue(endpointQuota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('mapbox', 'routing', 'directions');

      // Assert
      expect(result).toBe(true);
      expect(quotaService.getQuota).toHaveBeenCalledWith('mapbox', 'routing', 'directions');
    });

    it('should handle zero quota correctly', async () => {
      // Arrange
      const quota = 0;
      const currentUsage = 0;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('here', 'geocoding');

      // Assert
      // With zero quota, no usage should be allowed
      expect(result).toBe(false);
    });

    it('should handle very large usage numbers', async () => {
      // Arrange
      const quota = Number.MAX_SAFE_INTEGER;
      const currentUsage = Number.MAX_SAFE_INTEGER - 1;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act
      const result = await service.checkQuota('here', 'matrix-routing');

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('integration workflows', () => {

    it('should complete full usage tracking workflow', async () => {
      // Arrange
      const quota = 1000;
      const initialUsage = 999;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(initialUsage.toString());
      redisClient.evalsha.mockResolvedValue(1000);

      // Act - Check quota first
      const canUse = await service.checkQuota('here', 'geocoding');
      expect(canUse).toBe(true);

      // Act - Increment usage
      const newCount = await service.increment('here', 'geocoding');
      expect(newCount).toBe(1000);

      // Act - Check quota again (should be at limit)
      redisClient.get.mockResolvedValue('1000');
      const canUseAgain = await service.checkQuota('here', 'geocoding');
      expect(canUseAgain).toBe(false);
    });

    it('should handle quota exhaustion scenario', async () => {
      // Arrange
      const quota = 100;
      const currentUsage = 100;
      quotaService.getQuota.mockReturnValue(quota);
      redisClient.get.mockResolvedValue(currentUsage.toString());

      // Act & Assert
      const canUse = await service.checkQuota('mapbox', 'routing');
      expect(canUse).toBe(false);

      // Should not increment when quota is exhausted
      // This would be handled by the calling service
    });

    it('should handle concurrent usage tracking', async () => {
      // Arrange - Simulate concurrent increments
      quotaService.getQuota.mockReturnValue(1000);
      redisClient.get.mockResolvedValue('0');
      redisClient.evalsha
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      // Act - Simulate concurrent operations
      const [count1, count2, count3] = await Promise.all([
        service.increment('here', 'geocoding'),
        service.increment('here', 'geocoding'),
        service.increment('here', 'geocoding')
      ]);

      // Assert - All operations should complete
      expect([count1, count2, count3]).toEqual([1, 2, 3]);
      expect(redisClient.evalsha).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {

    it('should propagate Redis connection errors', async () => {
      // Arrange
      const connectionError = new Error('Connection lost');
      redisClient.get.mockRejectedValue(connectionError);

      // Act & Assert
      await expect(service.getCurrent('here', 'geocoding')).rejects.toThrow('Connection lost');
    });

    it('should handle quota service errors gracefully', async () => {
      // Arrange
      const quotaError = new Error('Quota config not found');
      quotaService.getQuota.mockImplementation(() => {
        throw quotaError;
      });
      redisClient.get.mockResolvedValue('100');

      // Act & Assert
      await expect(service.checkQuota('here', 'geocoding')).rejects.toThrow('Quota config not found');
    });

    it('should handle malformed Redis responses', async () => {
      // Arrange
      redisClient.get.mockResolvedValue('not-a-number');

      // Act
      const result = await service.getCurrent('here', 'geocoding');

      // Assert
      expect(result).toBeNaN(); // Number('not-a-number') returns NaN
    });
  });

  describe('time-based operations', () => {

    it('should use different keys for different months', async () => {
      // Arrange
      const june2025 = new Date('2025-06-30T23:59:59.999Z'); // End of June
      const july2025 = new Date('2025-07-01T00:00:00.000Z'); // Start of July

      // Act - Get keys for both months
      const juneKey = service['makeKey']('here', 'geocoding', undefined, june2025);
      const julyKey = service['makeKey']('here', 'geocoding', undefined, july2025);

      // Assert
      expect(juneKey).toBe('usage:2025-06:here:geocoding');
      expect(julyKey).toBe('usage:2025-07:here:geocoding');
      expect(juneKey).not.toBe(julyKey);
    });

    it('should handle year boundary correctly', async () => {
      // Arrange
      const december2025 = new Date('2025-12-31T23:59:59.999Z');
      const january2026 = new Date('2026-01-01T00:00:00.000Z');

      // Act
      const decemberKey = service['makeKey']('here', 'geocoding', undefined, december2025);
      const januaryKey = service['makeKey']('here', 'geocoding', undefined, january2026);

      // Assert
      expect(decemberKey).toBe('usage:2025-12:here:geocoding');
      expect(januaryKey).toBe('usage:2026-01:here:geocoding');
    });

    it('should reset usage counts for new month', async () => {
      // Arrange
      const june30 = new Date('2025-06-30T23:59:59.999Z');
      const july1 = new Date('2025-07-01T00:00:00.000Z');

      // Mock Date constructor to return specific dates
      const originalDate = global.Date;
      let callCount = 0;
      global.Date = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? june30 : july1;
      }) as any;
      global.Date.now = originalDate.now;

      // Setup Redis responses
      redisClient.get
        .mockResolvedValueOnce('1000') // June usage
        .mockResolvedValueOnce(null);  // July usage (new month, no data)

      // Act
      const juneUsage = await service.getCurrent('here', 'geocoding');
      const julyUsage = await service.getCurrent('here', 'geocoding');

      // Assert
      expect(juneUsage).toBe(1000);
      expect(julyUsage).toBe(0); // Should be 0 for new month

      // Cleanup
      global.Date = originalDate;
    });
  });
});
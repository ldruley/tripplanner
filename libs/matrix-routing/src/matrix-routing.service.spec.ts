import { Test, TestingModule } from '@nestjs/testing';
import { MatrixRoutingService } from './matrix-routing.service';
import { HereMatrixRoutingAdapterService } from './here/here-matrix-routing-adapter.service';
import { MapboxMatrixRoutingAdapterService } from './mapbox/mapbox-matrix-routing-adapter.service';
import { RedisService } from '@trip-planner/redis';
import { ApiUsageService } from '@trip-planner/api-usage';
import { ServiceUnavailableException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import { MatrixQuery, CoordinateMatrix, CoordinateMatrixSchema } from '@trip-planner/types';

describe('MatrixRoutingService', () => {
  let service: MatrixRoutingService;

  const mockHereAdapter = mock<HereMatrixRoutingAdapterService>();
  const mockMapboxAdapter = mock<MapboxMatrixRoutingAdapterService>();
  const mockRedisService = mock<RedisService>();
  const mockApiUsageService = mock<ApiUsageService>();

  const mockMatrixQuery: MatrixQuery = {
    origins: [
      { lat: 40.7128, lng: -74.006 }, // New York
      { lat: 34.0522, lng: -118.2437 }, // Los Angeles
    ],
    profile: 'carFast',
    routingMode: 'fast',
  };

  const mockCoordinateMatrix: CoordinateMatrix = {
    '40.7128,-74.006': {
      '40.7128,-74.006': { time: 0, distance: 0 },
      '34.0522,-118.2437': { time: 14400, distance: 4500000 },
    },
    '34.0522,-118.2437': {
      '40.7128,-74.006': { time: 14400, distance: 4500000 },
      '34.0522,-118.2437': { time: 0, distance: 0 },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatrixRoutingService,
        { provide: HereMatrixRoutingAdapterService, useValue: mockHereAdapter },
        { provide: MapboxMatrixRoutingAdapterService, useValue: mockMapboxAdapter },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ApiUsageService, useValue: mockApiUsageService },
      ],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<MatrixRoutingService>(MatrixRoutingService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getMatrixRouting', () => {
    it('should return cached results when available', async () => {
      // Arrange
      mockRedisService.getOrSet.mockResolvedValue(mockCoordinateMatrix);

      // Act
      const result = await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(mockRedisService.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('matrix:routing'),
        service['CACHE_TTL_MS'],
        expect.any(Function),
      );
    });

    it('should use Mapbox adapter when quota is available (priority order)', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true); // Mapbox quota available
      mockMapboxAdapter.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const result = await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('mapbox', 'matrix-routing');
      expect(mockMapboxAdapter.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('mapbox', 'matrix-routing');
      expect(mockHereAdapter.getMatrixRouting).not.toHaveBeenCalled();
    });

    it('should fallback to HERE adapter when Mapbox quota is exhausted', async () => {
      // Arrange
      mockApiUsageService.checkQuota
        .mockResolvedValueOnce(false) // Mapbox quota exhausted
        .mockResolvedValueOnce(true); // HERE quota available
      mockHereAdapter.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const result = await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('mapbox', 'matrix-routing');
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('here', 'matrix-routing');
      expect(mockHereAdapter.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('here', 'matrix-routing');
      expect(mockMapboxAdapter.getMatrixRouting).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when all quotas are exhausted', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(false); // All quotas exhausted
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(
        'No API quota available for matrix routing',
      );
    });

    it('should validate results with Zod schema', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockMapboxAdapter.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const result = await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(() => CoordinateMatrixSchema.parse(result)).not.toThrow();
    });
  });

  describe('implementMatrixStrategy', () => {
    it('should prioritize Mapbox adapter over HERE', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(true); // Both available
      mockMapboxAdapter.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);

      // Act
      const result = await service.implementMatrixStrategy(mockMatrixQuery);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(mockMapboxAdapter.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
      expect(mockHereAdapter.getMatrixRouting).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      const emptyMatrix: CoordinateMatrix = {};
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockMapboxAdapter.getMatrixRouting.mockResolvedValue(emptyMatrix);

      // Act
      const result = await service.implementMatrixStrategy(mockMatrixQuery);

      // Assert
      expect(result).toEqual(emptyMatrix);
      expect(mockMapboxAdapter.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
    });

    it('should increment API usage after successful call', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockMapboxAdapter.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);

      // Act
      await service.implementMatrixStrategy(mockMatrixQuery);

      // Assert
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('mapbox', 'matrix-routing');
    });
  });

  describe('error handling', () => {
    it('should handle adapter errors gracefully', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockMapboxAdapter.getMatrixRouting.mockRejectedValue(new Error('Adapter error'));
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow('Adapter error');
    });

    it('should propagate BadGatewayException from adapters', async () => {
      // Arrange
      const badGatewayError = new Error('Failed to fetch matrix data from HERE API');
      mockApiUsageService.checkQuota
        .mockResolvedValueOnce(false) // Mapbox exhausted
        .mockResolvedValueOnce(true); // HERE available
      mockHereAdapter.getMatrixRouting.mockRejectedValue(badGatewayError);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(
        'Failed to fetch matrix data from HERE API',
      );
    });
  });

  describe('caching behavior', () => {
    it('should use cache TTL of 24 hours', async () => {
      // Arrange
      mockRedisService.getOrSet.mockResolvedValue(mockCoordinateMatrix);

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(mockRedisService.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        86400, // 24 * 60 * 60 seconds
        expect.any(Function),
      );
    });

    it('should generate cache key with query parameters', async () => {
      // Arrange
      mockRedisService.getOrSet.mockResolvedValue(mockCoordinateMatrix);

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(mockRedisService.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('matrix:routing'),
        expect.any(Number),
        expect.any(Function),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { GeocodingService } from './geocoding.service';
import { MapboxGeocodeAdapterService } from './mapbox/mapbox-geocode-adapter.service';
import { HereGeocodeAdapterService } from './here/here-geocode-adapter.service';
import { RedisService } from '@trip-planner/redis';
import { ApiUsageService } from '@trip-planner/api-usage';
import { ServiceUnavailableException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import {
  ForwardGeocodeQuery,
  ReverseGeocodeQuery,
  GeocodingResult,
  GeocodingResultSchema,
} from '@trip-planner/types';

describe('GeocodingService', () => {
  let service: GeocodingService;

  const mockMapboxAdapter = mock<MapboxGeocodeAdapterService>();
  const mockHereAdapter = mock<HereGeocodeAdapterService>();
  const mockRedisService = mock<RedisService>();
  const mockApiUsageService = mock<ApiUsageService>();

  const forwardQuery: ForwardGeocodeQuery = {
    search: 'New York, NY',
  };

  const reverseQuery: ReverseGeocodeQuery = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  const mockGeocodingResults: GeocodingResult[] = [
    {
      latitude: 40.7128,
      longitude: -74.006,
      fullAddress: 'New York, NY, USA',
      streetAddress: 'Broadway',
      provider: 'here',
      providerId: 'here123',
      country: 'USA',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeocodingService,
        { provide: MapboxGeocodeAdapterService, useValue: mockMapboxAdapter },
        { provide: HereGeocodeAdapterService, useValue: mockHereAdapter },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ApiUsageService, useValue: mockApiUsageService },
      ],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<GeocodingService>(GeocodingService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('forwardGeocode', () => {
    it('should return cached results when available', async () => {
      // Arrange
      mockRedisService.getOrSet.mockResolvedValue(mockGeocodingResults);

      // Act
      const results = await service.forwardGeocode(forwardQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockRedisService.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('geocode:forward'),
        service['CACHE_TTL_MS'],
        expect.any(Function),
      );
    });

    it('should use HERE adapter when quota is available', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true); // HERE quota available
      mockHereAdapter.forwardGeocode.mockResolvedValue(mockGeocodingResults);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const results = await service.forwardGeocode(forwardQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockHereAdapter.forwardGeocode).toHaveBeenCalledWith(forwardQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockMapboxAdapter.forwardGeocode).not.toHaveBeenCalled();
    });

    it('should fallback to Mapbox adapter when HERE quota is exhausted', async () => {
      // Arrange
      mockApiUsageService.checkQuota
        .mockResolvedValueOnce(false) // HERE quota exhausted
        .mockResolvedValueOnce(true); // Mapbox quota available
      mockMapboxAdapter.forwardGeocode.mockResolvedValue(mockGeocodingResults);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const results = await service.forwardGeocode(forwardQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('mapbox', 'geocoding');
      expect(mockMapboxAdapter.forwardGeocode).toHaveBeenCalledWith(forwardQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('mapbox', 'geocoding');
      expect(mockHereAdapter.forwardGeocode).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when all quotas are exhausted', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(false); // All quotas exhausted
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.forwardGeocode(forwardQuery)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.forwardGeocode(forwardQuery)).rejects.toThrow(
        'No geocoding provider available or quota exceeded',
      );
    });

    it('should validate results with Zod schema', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.forwardGeocode.mockResolvedValue(mockGeocodingResults);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const results = await service.forwardGeocode(forwardQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      results.forEach(result => {
        expect(() => GeocodingResultSchema.parse(result)).not.toThrow();
      });
    });
  });

  describe('reverseGeocode', () => {
    it('should return cached results when available', async () => {
      // Arrange
      mockRedisService.getOrSet.mockResolvedValue(mockGeocodingResults);

      // Act
      const results = await service.reverseGeocode(reverseQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockRedisService.getOrSet).toHaveBeenCalledWith(
        expect.stringContaining('geocode:reverse'),
        service['CACHE_TTL_MS'],
        expect.any(Function),
      );
    });

    it('should use HERE adapter when quota is available (after bug fix)', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true); // HERE quota available
      mockHereAdapter.reverseGeocode.mockResolvedValue(mockGeocodingResults);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const results = await service.reverseGeocode(reverseQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockHereAdapter.reverseGeocode).toHaveBeenCalledWith(reverseQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockMapboxAdapter.reverseGeocode).not.toHaveBeenCalled();
    });

    it('should fallback to Mapbox adapter when HERE quota is exhausted (after bug fix)', async () => {
      // Arrange
      mockApiUsageService.checkQuota
        .mockResolvedValueOnce(false) // HERE quota exhausted
        .mockResolvedValueOnce(true); // Mapbox quota available
      mockMapboxAdapter.reverseGeocode.mockResolvedValue(mockGeocodingResults);
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act
      const results = await service.reverseGeocode(reverseQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('here', 'geocoding');
      expect(mockApiUsageService.checkQuota).toHaveBeenCalledWith('mapbox', 'geocoding');
      expect(mockMapboxAdapter.reverseGeocode).toHaveBeenCalledWith(reverseQuery);
      expect(mockApiUsageService.increment).toHaveBeenCalledWith('mapbox', 'geocoding');
      expect(mockHereAdapter.reverseGeocode).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when all quotas are exhausted', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(false); // All quotas exhausted
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.reverseGeocode(reverseQuery)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.reverseGeocode(reverseQuery)).rejects.toThrow(
        'No geocoding provider available or quota exceeded',
      );
    });
  });

  describe('implementForwardGeocodeStrategy', () => {
    it('should prioritize HERE adapter over Mapbox', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(true); // Both available
      mockHereAdapter.forwardGeocode.mockResolvedValue(mockGeocodingResults);

      // Act
      const results = await service.implementForwardGeocodeStrategy(forwardQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockHereAdapter.forwardGeocode).toHaveBeenCalledWith(forwardQuery);
      expect(mockMapboxAdapter.forwardGeocode).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.forwardGeocode.mockResolvedValue([]);

      // Act
      const results = await service.implementForwardGeocodeStrategy(forwardQuery);

      // Assert
      expect(results).toEqual([]);
      expect(mockHereAdapter.forwardGeocode).toHaveBeenCalledWith(forwardQuery);
    });
  });

  describe('implementReverseGeocodeStrategy', () => {
    it('should prioritize HERE adapter over Mapbox', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValue(true); // Both available
      mockHereAdapter.reverseGeocode.mockResolvedValue(mockGeocodingResults);

      // Act
      const results = await service.implementReverseGeocodeStrategy(reverseQuery);

      // Assert
      expect(results).toEqual(mockGeocodingResults);
      expect(mockHereAdapter.reverseGeocode).toHaveBeenCalledWith(reverseQuery);
      expect(mockMapboxAdapter.reverseGeocode).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully in forward geocoding', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.forwardGeocode.mockRejectedValue(new Error('Service error'));
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.forwardGeocode(forwardQuery)).rejects.toThrow('Service error');
    });

    it('should handle service errors gracefully in reverse geocoding', async () => {
      // Arrange
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.reverseGeocode.mockRejectedValue(new Error('Service error'));
      mockRedisService.getOrSet.mockImplementation(async (key, ttl, factory) => {
        return await factory();
      });

      // Act & Assert
      await expect(service.reverseGeocode(reverseQuery)).rejects.toThrow('Service error');
    });
  });
});

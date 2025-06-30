import { Test, TestingModule } from '@nestjs/testing';
import { PoiService } from './poi.service';
import { RedisService } from '../../redis/src/redis.service';
import { ApiUsageService } from '../../api-usage/src/api-usage.service';
import { HerePoiAdapterService } from './here/here-poi-adapter.service';
import { MapboxPoiAdapterService } from './mapbox/mapbox-poi-adapter.service';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { PoiSearchQuery, PoiSearchResultSchema } from '@trip-planner/types';

describe('PoiService', () => {
  let service: PoiService;

  const mockRedisService = mock<RedisService>();
  const mockApiUsageService = mock<ApiUsageService>();
  const mockHereAdapter = mock<HerePoiAdapterService>();
  const mockMapboxAdapter = mock<MapboxPoiAdapterService>();

  const query: PoiSearchQuery = {
    search: 'coffee',
    proximity: `40.7128,-74.006`,
    limit: 2
  };

  const hereResults = [
    {
      name: 'Coffee Shop',
      latitude: 40.7129,
      longitude: -74.0059,
      fullAddress: '123 Main St, NYC',
      streetAddress: '123 Main St',
      city: 'New York',
      region: 'NY',
      country: 'USA',
      postalCode: '10001',
      provider: 'here' as const,
      providerId: 'here-abc',
      rawResponse: '{"some":"raw data"}'
    }
  ];

  const mapboxResults = [
    {
      name: 'Mapbox Cafe',
      latitude: 40.713,
      longitude: -74.0061,
      fullAddress: '456 Broad St, NYC',
      streetAddress: '456 Broad St',
      city: 'New York',
      region: 'NY',
      country: 'USA',
      postalCode: '10002',
      provider: 'mapbox' as const,
      providerId: 'mapbox-xyz',
      rawResponse: '{"some":"raw data"}'
    }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoiService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: ApiUsageService, useValue: mockApiUsageService },
        { provide: HerePoiAdapterService, useValue: mockHereAdapter },
        { provide: MapboxPoiAdapterService, useValue: mockMapboxAdapter},
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-here-key')
          }
        }
      ]
    }).compile();

    service = module.get<PoiService>(PoiService);

    jest.clearAllMocks();
  });

  it('returns cached results if present', async () => {
    mockRedisService.getOrSet.mockResolvedValueOnce(hereResults);

    const result = await service.poiSearch(query);
    expect(mockRedisService.getOrSet).toHaveBeenCalled();
    expect(mockHereAdapter.searchPoi).not.toHaveBeenCalled();
    expect(result).toEqual(hereResults);
  });

  it('calls strategy and caches result if cache is missed', async () => {
    mockRedisService.getOrSet.mockImplementation(async (_key, _ttl, fn) => await fn());
    mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
    mockHereAdapter.searchPoi.mockResolvedValueOnce(hereResults);

    const result = await service.poiSearch(query);
    expect(mockHereAdapter.searchPoi).toHaveBeenCalledWith(query);
    expect(result).toEqual(hereResults);
  });

  describe('implementStrategy', () => {
    it('uses HERE if quota is available', async () => {
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.searchPoi.mockResolvedValueOnce(hereResults);

      const result = await service.implementStrategy(query);

      expect(mockHereAdapter.searchPoi).toHaveBeenCalledWith(query);
      expect(result).toEqual(hereResults);
    });

    it('falls back to Mapbox if HERE quota is exceeded', async () => {
      mockApiUsageService.checkQuota.mockResolvedValueOnce(false); // HERE
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);  // Mapbox
      mockMapboxAdapter.searchPoi.mockResolvedValueOnce(mapboxResults);

      const result = await service.implementStrategy(query);

      expect(mockHereAdapter.searchPoi).not.toHaveBeenCalled();
      expect(mockMapboxAdapter.searchPoi).toHaveBeenCalledWith(query);
      expect(result).toEqual(mapboxResults);
    });

    it('throws ServiceUnavailableException when no providers are available', async () => {
      mockApiUsageService.checkQuota.mockResolvedValue(false);

      await expect(service.implementStrategy(query)).rejects.toThrow(ServiceUnavailableException);
      await expect(service.implementStrategy(query)).rejects.toThrow('No API quota available for POI search');
    });
  });

  describe('result shape validation', () => {
    it('validates that results conform to PoiSearchResultSchema', async () => {
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.searchPoi.mockResolvedValueOnce(hereResults);

      const result = await service.poiSearch(query);

      for (const item of result) {
        const parsed = PoiSearchResultSchema.safeParse(item);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('returns empty array if adapter returns nothing', async () => {
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.searchPoi.mockResolvedValueOnce([]);

      const result = await service.poiSearch(query);
      expect(result).toEqual([]);
    });

    it('throws on malformed adapter result', async () => {
      mockApiUsageService.checkQuota.mockResolvedValueOnce(true);
      mockHereAdapter.searchPoi.mockResolvedValueOnce([
        { invalid: 'value' } as any
      ]);

      const result = await service.poiSearch(query);
      for (const item of result) {
        const parsed = PoiSearchResultSchema.safeParse(item);
        expect(parsed.success).toBe(false);
      }
    });
  });
});

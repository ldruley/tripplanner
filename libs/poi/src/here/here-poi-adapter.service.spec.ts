import { Test, TestingModule } from '@nestjs/testing';
import { HerePoiAdapterService } from './here-poi-adapter.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { PoiSearchQueryDto, PoiSearchResultSchema } from '../../../shared/types/src/schemas/search.schema';
import { AxiosHeaders } from 'axios';
import { LoggerService } from '@nestjs/common';

const mockLogger: LoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

describe('HerePoiAdapterService', () => {
  let service: HerePoiAdapterService;
  let httpService: jest.Mocked<HttpService>;

  const mockApiKey = 'mock-here-api-key';
  const query: PoiSearchQueryDto = {
    search: 'coffee',
    proximity: `40.7128,-74.006`,
    limit: 1
  };

  const mockResponse: AxiosResponse = {
    data: {
      items: [
        {
          id: 'poi-123',
          title: 'Coffee Shop',
          position: { lat: 36.9769, lng: -122.0306 },
          address: {
            label: '123 Main St, Santa Cruz, CA',
            street: 'Main St',
            houseNumber: '123',
            city: 'Santa Cruz',
            state: 'CA',
            countryName: 'USA',
            postalCode: '95060',
          },
        },
      ],
    },
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: {
      headers: new AxiosHeaders(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HerePoiAdapterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockApiKey)
          }
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn()
          }
        }
      ]
    })
    .setLogger(mockLogger)
    .compile();

    service = module.get<HerePoiAdapterService>(HerePoiAdapterService);
    httpService = module.get(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should transform HERE API data into PoiSearchResult[]', async () => {
    httpService.get.mockReturnValueOnce(of(mockResponse));

    const results = await service.searchPoi(query);

    expect(results).toHaveLength(1);
    const parsed = PoiSearchResultSchema.safeParse(results[0]);
    expect(parsed.success).toBe(true);
    expect(results[0]).toMatchObject({
      name: 'Coffee Shop',
      latitude: 36.9769,
      longitude: -122.0306,
      fullAddress: '123 Main St, Santa Cruz, CA',
      provider: 'here',
      providerId: 'poi-123'
    });
  });

  it('should filter out invalid items from the API response', async () => {
    // One item is valid, the other is missing its 'position'
    const mixedResponse: AxiosResponse = {
      ...mockResponse,
      data: {
        items: [
          mockResponse.data.items[0], // The valid coffee shop
          {
            id: 'poi-789-invalid',
            title: 'A broken item',
            // `position` is missing, which will cause Zod validation to fail
            address: { label: 'some address' }
          }
        ]
      }
    };
    httpService.get.mockReturnValueOnce(of(mixedResponse));

    const results = await service.searchPoi(query);

    // The final result should only contain the one valid item
    expect(results).toHaveLength(1);
    expect(results[0].providerId).toBe('poi-123');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Invalid POI result from HERE',
      expect.any(Object),
      'HerePoiAdapterService'
    );
  });

  it('should return an empty array if the API returns no items', async () => {
    const emptyResponse: AxiosResponse = {
      ...mockResponse,
      data: {
        items: [], // Empty items array
      },
    };

    httpService.get.mockReturnValueOnce(of(emptyResponse));

    const results = await service.searchPoi(query);

    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(0);
  });

  it('should handle missing address fields gracefully', async () => {
    const brokenData = {
      ...mockResponse,
      data: {
        items: [
          {
            id: 'poi-456',
            title: 'Mystery Place',
            position: { lat: 1, lng: 2 },
            address: {}
          }
        ]
      }
    };

    httpService.get.mockReturnValueOnce(of(brokenData));

    const results = await service.searchPoi(query);

    expect(results[0]).toMatchObject({
      name: 'Mystery Place',
      fullAddress: 'No address available',
      streetAddress: 'No street address available',
      city: 'Unknown city',
      region: 'Unknown region',
      country: 'Unknown country',
      postalCode: 'Unknown postal code'
    });
  });

  it('should throw if HERE API returns an error', async () => {
    const error = new Error('HERE API failed');
    httpService.get.mockReturnValueOnce(throwError(() => error));

    await expect(service.searchPoi(query)).rejects.toThrow('Failed to search POI');
    expect(mockLogger.error).toHaveBeenCalledWith('Error fetching POI data', error, 'HerePoiAdapterService');
  });

  describe('Configuration Errors', () => {
    it('should throw an error if HERE_API_KEY is missing', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          HerePoiAdapterService,
          {
            provide: ConfigService,
            useValue: {
              // Mock a config service that returns undefined for the key
              get: jest.fn().mockReturnValue(undefined),
            },
          },
          { provide: HttpService, useValue: { get: jest.fn() } },
        ],
      }).setLogger(mockLogger);

      // Assert that the module fails to compile, which is the expected behavior
      await expect(moduleBuilder.compile()).rejects.toThrow(
        'Here access token is required',
      );
    });
  });
});

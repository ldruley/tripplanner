import { LoggerService } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MapboxPoiAdapterService } from './mapbox-poi-adapter.service';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { PoiSearchQueryDto } from '@trip-planner/shared/dtos';
import { PoiSearchResultSchema } from '@trip-planner/types';


const mockLogger: LoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

describe('MapboxPoiAdapterService', () => {
  let service: MapboxPoiAdapterService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockApiKey = 'mock-mapbox-api-key';
  const mockBaseUrl = 'https://api.mapbox.com';

  const query: PoiSearchQueryDto = {
    search: 'coffee',
    proximity: `40.7128,-74.006`,
    limit: 1
  };

  const mockMapboxResponse: AxiosResponse = {
    data: {
      features: [
        {
          properties: {
            mapbox_id: 'mapbox-poi-123',
            name: 'Awesome Coffee Place',
            full_address: '123 Main St, Santa Cruz, CA 95060, United States',
            address: '123 Main St',
            coordinates: {
              latitude: 36.9769,
              longitude: -122.0306,
            },
            context: {
              country: { name: 'United States' },
              region: { name: 'CA' },
              place: { name: 'Santa Cruz' },
              postcode: { name: '95060' },
            },
          },
        },
      ],
    },
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapboxPoiAdapterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'MAPBOX_API_KEY') return mockApiKey;
              if (key === 'MAPBOX_BASE_URL') return mockBaseUrl;
              return null;
            }),
          }
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        }
      ]
    })
    .setLogger(mockLogger)
    .compile();

    service = module.get<MapboxPoiAdapterService>(MapboxPoiAdapterService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  })

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should transform Mapbox API data into PoiSearchResult[]', async () => {
    httpService.get.mockReturnValueOnce(of(mockMapboxResponse));

    const results = await service.searchPoi(query);

    expect(results).toHaveLength(1);
    const parsed = PoiSearchResultSchema.safeParse(results[0]);
    expect(parsed.success).toBe(true);

    expect(results[0]).toMatchObject({
      name: 'Awesome Coffee Place',
      latitude: 36.9769,
      longitude: -122.0306,
      fullAddress: '123 Main St, Santa Cruz, CA 95060, United States',
      streetAddress: '123 Main St',
      city: 'Santa Cruz',
      region: 'CA',
      country: 'United States',
      postalCode: '95060',
      provider: 'mapbox',
      providerId: 'mapbox-poi-123',
    });
  });

  it('should return an empty array if the API returns no features', async () => {
    const emptyResponse: AxiosResponse = {
      ...mockMapboxResponse,
      data: { features: [] },
    };
    httpService.get.mockReturnValueOnce(of(emptyResponse));

    const results = await service.searchPoi(query);

    expect(results).toBeInstanceOf(Array);
    expect(results).toHaveLength(0);
  });

  it('should handle missing address fields gracefully', async () => {
    const brokenDataResponse: AxiosResponse = {
      ...mockMapboxResponse,
      data: {
        features: [
          {
            properties: {
              mapbox_id: 'mapbox-poi-456',
              name: 'A Place with No Address',
              coordinates: { latitude: 39.7817, longitude: -89.6501 },
              // 'full_address', 'address', and 'context' are missing
            },
          },
        ],
      },
    };
    httpService.get.mockReturnValueOnce(of(brokenDataResponse));

    const results = await service.searchPoi(query);

    expect(results[0]).toMatchObject({
      name: 'A Place with No Address',
      fullAddress: 'No address available',
      streetAddress: 'No street address available',
      city: 'Unknown city',
      region: 'Unknown region',
      country: 'Unknown country',
      postalCode: 'Unknown postal code',
    });
  });

  describe('Configuration Errors', () => {
    it('should throw an error if MAPBOX_API_KEY is missing', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxPoiAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => (key === 'MAPBOX_BASE_URL' ? mockBaseUrl : undefined),
            },
          },
          { provide: HttpService, useValue: { get: jest.fn() } },
        ],
      }).setLogger(mockLogger);

      await expect(moduleBuilder.compile()).rejects.toThrow(
        'Mapbox access token is required',
      );
    });

    it('should throw an error if MAPBOX_BASE_URL is missing', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxPoiAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) => (key === 'MAPBOX_API_KEY' ? mockApiKey : undefined),
            },
          },
          { provide: HttpService, useValue: { get: jest.fn() } },
        ],
      }).setLogger(mockLogger);

      await expect(moduleBuilder.compile()).rejects.toThrow(
        'Mapbox base URL is required',
      );
    });
  });
});

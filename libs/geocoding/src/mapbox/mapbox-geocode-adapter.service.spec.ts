import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MapboxGeocodeAdapterService } from './mapbox-geocode-adapter.service';
import { InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { createMockLogger, mockLoggerClass, restoreLoggerClass } from '@trip-planner/test-utils';
import {
  ForwardGeocodeQuery,
  ReverseGeocodeQuery,
  GeocodingResult,
  GeocodingResultSchema,
} from '@trip-planner/types';

describe('MapboxGeocodeAdapterService', () => {
  let service: MapboxGeocodeAdapterService;
  let configService: ConfigService;
  let httpService: ReturnType<typeof mock<HttpService>>;

  beforeAll(() => {
    mockLoggerClass();
  });

  afterAll(() => {
    restoreLoggerClass();
  });

  const mockForwardQuery: ForwardGeocodeQuery = {
    search: 'New York, NY',
  };

  const mockReverseQuery: ReverseGeocodeQuery = {
    latitude: 40.7128,
    longitude: -74.006,
  };

  const mockMapboxForwardResponse = {
    data: {
      features: [
        {
          properties: {
            name: 'New York',
            full_address: 'New York, NY, USA',
            mapbox_id: 'mapbox123',
            coordinates: {
              latitude: 40.7128,
              longitude: -74.006,
            },
            context: {
              place: {
                name: 'New York',
              },
              region: {
                name: 'New York',
              },
              country: {
                name: 'United States',
              },
              postcode: {
                name: '10001',
              },
            },
          },
          id: 'mapbox123',
        },
      ],
    },
  };

  const mockMapboxReverseResponse = {
    data: {
      features: [
        {
          properties: {
            name: 'Broadway',
            full_address: 'Broadway, New York, NY, USA',
            mapbox_id: 'mapbox456',
            coordinates: {
              latitude: 40.7128,
              longitude: -74.006,
            },
            context: {
              place: {
                name: 'New York',
              },
              region: {
                name: 'New York',
              },
              country: {
                name: 'United States',
              },
              postcode: {
                name: '10001',
              },
            },
          },
          id: 'mapbox456',
        },
      ],
    },
  };

  beforeEach(async () => {
    httpService = mock<HttpService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapboxGeocodeAdapterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-mapbox-api-key'),
          },
        },
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<MapboxGeocodeAdapterService>(MapboxGeocodeAdapterService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with API key from config', () => {
      expect(configService.get).toHaveBeenCalledWith('MAPBOX_API_KEY');
    });
  });

  describe('forwardGeocode', () => {
    it('should successfully geocode a location', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxForwardResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        latitude: 40.7128,
        longitude: -74.006,
        fullAddress: 'New York, NY, USA',
        streetAddress: 'New York',
        city: 'New York',
        region: 'New York',
        country: 'United States',
        postalCode: '10001',
        provider: 'mapbox',
        providerId: 'mapbox123',
      });

      // Validate with Zod schema
      results.forEach(result => {
        expect(() => GeocodingResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should handle empty response gracefully', async () => {
      // Arrange
      const emptyResponse: AxiosResponse = {
        data: { features: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(emptyResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results).toEqual([]);
    });

    it('should handle missing context fields gracefully', async () => {
      // Arrange
      const incompleteResponse: AxiosResponse = {
        data: {
          features: [
            {
              properties: {
                name: 'Incomplete Location',
                full_address: 'Incomplete Location',
                mapbox_id: 'mapbox789',
                coordinates: {
                  latitude: 40.7128,
                  longitude: -74.006,
                },
                // Missing context
              },
              id: 'mapbox789',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(incompleteResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        latitude: 40.7128,
        longitude: -74.006,
        fullAddress: 'Incomplete Location',
        streetAddress: 'Incomplete Location',
        city: 'No city found',
        region: 'No region found',
        country: 'No country found',
        postalCode: 'No postal code found',
        provider: 'mapbox',
        providerId: 'mapbox789',
      });
    });

    it('should throw BadGatewayException on HTTP error', async () => {
      // Arrange
      const error = new Error('Network error');
      httpService.get.mockReturnValueOnce(throwError(() => error));

      // Act & Assert
      await expect(service.forwardGeocode(mockForwardQuery)).rejects.toThrow(BadGatewayException);
      await expect(service.forwardGeocode(mockForwardQuery)).rejects.toThrow(
        'Failed to perform forward geocoding',
      );
    });

    it('should include rawResponse in development mode', async () => {
      // Arrange
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxForwardResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results[0].rawResponse).toBeDefined();
      expect(results[0].rawResponse).toEqual(mockMapboxForwardResponse.data.features[0]);

      // Cleanup
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not include rawResponse in production mode', async () => {
      // Arrange
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxForwardResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results[0].rawResponse).toBeUndefined();

      // Cleanup
      process.env['NODE_ENV'] = originalEnv;
    });
  });

  describe('reverseGeocode', () => {
    it('should successfully reverse geocode coordinates', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxReverseResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const results = await service.reverseGeocode(mockReverseQuery);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        latitude: 40.7128,
        longitude: -74.006,
        fullAddress: 'Broadway, New York, NY, USA',
        streetAddress: 'Broadway',
        city: 'New York',
        region: 'New York',
        country: 'United States',
        postalCode: '10001',
        provider: 'mapbox',
        providerId: 'mapbox456',
      });

      // Validate with Zod schema
      results.forEach(result => {
        expect(() => GeocodingResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should handle empty reverse geocoding response', async () => {
      // Arrange
      const emptyResponse: AxiosResponse = {
        data: { features: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(emptyResponse));

      // Act
      const results = await service.reverseGeocode(mockReverseQuery);

      // Assert
      expect(results).toEqual([]);
    });

    it('should throw BadGatewayException on HTTP error', async () => {
      // Arrange
      const error = new Error('Network error');
      httpService.get.mockReturnValueOnce(throwError(() => error));

      // Act & Assert
      await expect(service.reverseGeocode(mockReverseQuery)).rejects.toThrow(BadGatewayException);
      await expect(service.reverseGeocode(mockReverseQuery)).rejects.toThrow(
        'Failed to perform reverse geocoding',
      );
    });

    it('should format coordinates correctly in API call', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxReverseResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.reverseGeocode(mockReverseQuery);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('longitude=-74.006'));
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('latitude=40.7128'));
    });
  });

  describe('Configuration Errors', () => {
    it('should throw InternalServerErrorException if MAPBOX_API_KEY is missing', async () => {
      // This test creates a new service instance with missing API key
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxGeocodeAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(null),
            },
          },
          {
            provide: HttpService,
            useValue: httpService,
          },
        ],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException with correct message for missing API key', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxGeocodeAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
          {
            provide: HttpService,
            useValue: httpService,
          },
        ],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow('Mapbox access token is required');
    });
  });

  describe('processResponse', () => {
    it('should filter out invalid results', async () => {
      // Arrange
      const mixedResponse: AxiosResponse = {
        data: {
          features: [
            // Valid item
            {
              properties: {
                name: 'Valid Location',
                full_address: 'Valid Location, USA',
                mapbox_id: 'valid123',
                coordinates: {
                  latitude: 40.7128,
                  longitude: -74.006,
                },
                context: {
                  country: { name: 'United States' },
                },
              },
              id: 'valid123',
            },
            // Invalid item (missing coordinates)
            {
              properties: {
                name: 'Invalid Location',
                full_address: 'Invalid Location',
                coordinates: null, // Invalid coordinates
              },
              id: 'invalid456',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mixedResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].providerId).toBe('valid123');
    });

    it('should handle coordinates array correctly', async () => {
      // Arrange - Mapbox returns coordinates as [longitude, latitude]
      const coordResponse: AxiosResponse = {
        data: {
          features: [
            {
              properties: {
                name: 'Test Location',
                full_address: 'Test Location, USA',
                mapbox_id: 'coord123',
                coordinates: {
                  latitude: 37.7749,
                  longitude: -122.4194,
                },
              },
              id: 'coord123',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(coordResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results[0].longitude).toBe(-122.4194);
      expect(results[0].latitude).toBe(37.7749);
    });

    it('should extract street address from context when available', async () => {
      // Arrange
      const streetResponse: AxiosResponse = {
        data: {
          features: [
            {
              properties: {
                name: 'Main Street',
                full_address: 'Main St, City, State',
                mapbox_id: 'street123',
                coordinates: {
                  latitude: 40.7128,
                  longitude: -74.006,
                },
                context: {
                  place: {
                    name: 'City',
                  },
                },
              },
              id: 'street123',
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(streetResponse));

      // Act
      const results = await service.forwardGeocode(mockForwardQuery);

      // Assert
      expect(results[0].streetAddress).toBe('Main Street');
    });
  });
});

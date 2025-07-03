import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HereGeocodeAdapterService } from './here-geocode-adapter.service';
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

describe('HereGeocodeAdapterService', () => {
  let service: HereGeocodeAdapterService;
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

  const mockHereForwardResponse = {
    data: {
      items: [
        {
          title: 'New York, NY, USA',
          address: {
            label: 'New York, NY, USA',
            countryName: 'United States',
            state: 'New York',
            city: 'New York',
            postalCode: '10001',
            street: 'Broadway',
          },
          position: {
            lat: 40.7128,
            lng: -74.006,
          },
          id: 'here123',
        },
      ],
    },
  };

  const mockHereReverseResponse = {
    data: {
      items: [
        {
          title: 'Broadway, New York, NY, USA',
          address: {
            label: 'Broadway, New York, NY, USA',
            countryName: 'United States',
            state: 'New York',
            city: 'New York',
            postalCode: '10001',
            street: 'Broadway',
          },
          position: {
            lat: 40.7128,
            lng: -74.006,
          },
          id: 'here456',
        },
      ],
    },
  };

  beforeEach(async () => {
    httpService = mock<HttpService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HereGeocodeAdapterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-here-api-key'),
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

    service = module.get<HereGeocodeAdapterService>(HereGeocodeAdapterService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with API key from config', () => {
      expect(configService.get).toHaveBeenCalledWith('HERE_API_KEY');
    });
  });

  describe('forwardGeocode', () => {
    it('should successfully geocode a location', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockHereForwardResponse,
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
        streetAddress: 'Broadway',
        city: 'New York',
        region: 'New York',
        country: 'United States',
        postalCode: '10001',
        provider: 'here',
        providerId: 'here123',
      });

      // Validate with Zod schema
      results.forEach(result => {
        expect(() => GeocodingResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should handle empty response gracefully', async () => {
      // Arrange
      const emptyResponse: AxiosResponse = {
        data: { items: [] },
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

    it('should handle missing address fields gracefully', async () => {
      // Arrange
      const incompleteResponse: AxiosResponse = {
        data: {
          items: [
            {
              title: 'Incomplete Location',
              address: {
                label: 'Incomplete Location',
                countryName: 'United States',
                // Missing other fields
              },
              position: {
                lat: 40.7128,
                lng: -74.006,
              },
              id: 'here789',
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
        streetAddress: 'Unknown street address',
        city: 'Unknown city',
        region: 'Unknown region',
        country: 'United States',
        postalCode: 'Unknown postal code',
        provider: 'here',
        providerId: 'here789',
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
        ...mockHereForwardResponse,
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
      expect(results[0].rawResponse).toEqual(mockHereForwardResponse.data.items[0]);

      // Cleanup
      process.env['NODE_ENV'] = originalEnv;
    });

    it('should not include rawResponse in production mode', async () => {
      // Arrange
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const mockAxiosResponse: AxiosResponse = {
        ...mockHereForwardResponse,
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
        ...mockHereReverseResponse,
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
        provider: 'here',
        providerId: 'here456',
      });

      // Validate with Zod schema
      results.forEach(result => {
        expect(() => GeocodingResultSchema.parse(result)).not.toThrow();
      });
    });

    it('should handle empty reverse geocoding response', async () => {
      // Arrange
      const emptyResponse: AxiosResponse = {
        data: { items: [] },
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
        ...mockHereReverseResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.reverseGeocode(mockReverseQuery);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('at=40.7128%2C-74.006'));
    });
  });

  describe('Configuration Errors', () => {
    it('should throw InternalServerErrorException if HERE_API_KEY is missing', async () => {
      // This test creates a new service instance with missing API key
      const moduleBuilder = Test.createTestingModule({
        providers: [
          HereGeocodeAdapterService,
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
          HereGeocodeAdapterService,
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

      await expect(moduleBuilder.compile()).rejects.toThrow('Here access token is required');
    });
  });

  describe('processResponse', () => {
    it('should filter out invalid results', async () => {
      // Arrange
      const mixedResponse: AxiosResponse = {
        data: {
          items: [
            // Valid item
            {
              title: 'Valid Location',
              address: {
                label: 'Valid Location',
                countryName: 'United States',
                state: 'New York',
                city: 'New York',
                postalCode: '10001',
                street: 'Broadway',
              },
              position: {
                lat: 40.7128,
                lng: -74.006,
              },
              id: 'valid123',
            },
            // Invalid item (missing position)
            {
              title: 'Invalid Location',
              address: {
                label: 'Invalid Location',
              },
              position: null, // Invalid position
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
  });
});

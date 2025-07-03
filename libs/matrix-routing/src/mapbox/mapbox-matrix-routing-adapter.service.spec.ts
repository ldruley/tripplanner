import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { MapboxMatrixRoutingAdapterService } from './mapbox-matrix-routing-adapter.service';
import { InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { createMockLogger, mockLoggerClass, restoreLoggerClass } from '@trip-planner/test-utils';
import { MatrixQuery, CoordinateMatrix, CoordinateMatrixSchema } from '@trip-planner/types';

describe('MapboxMatrixRoutingAdapterService', () => {
  let service: MapboxMatrixRoutingAdapterService;
  let configService: ConfigService;
  let httpService: ReturnType<typeof mock<HttpService>>;

  beforeAll(() => {
    mockLoggerClass();
  });

  afterAll(() => {
    restoreLoggerClass();
  });

  const mockMatrixQuery: MatrixQuery = {
    origins: [
      { lat: 40.7128, lng: -74.006 }, // New York
      { lat: 34.0522, lng: -118.2437 }, // Los Angeles
    ],
    profile: 'carFast',
    routingMode: 'fast',
  };

  // Mapbox API returns 2D arrays for matrix data
  const mockMapboxResponse = {
    data: {
      durations: [
        [0, 14400], // NY to [NY, LA]
        [14400, 0], // LA to [NY, LA]
      ],
      distances: [
        [0, 4500000], // NY to [NY, LA] in meters
        [4500000, 0], // LA to [NY, LA] in meters
      ],
      code: 'Ok',
    },
  };

  beforeEach(async () => {
    httpService = mock<HttpService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapboxMatrixRoutingAdapterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValueOnce('test-mapbox-api-key') // MAPBOX_API_KEY
              .mockReturnValueOnce('https://api.mapbox.com'), // MAPBOX_BASE_URL
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

    service = module.get<MapboxMatrixRoutingAdapterService>(MapboxMatrixRoutingAdapterService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with API key and base URL from config', () => {
      expect(configService.get).toHaveBeenCalledWith('MAPBOX_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('MAPBOX_BASE_URL');
    });
  });

  describe('getMatrixRouting', () => {
    it('should successfully get matrix routing data', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const result = await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result['40.7128,-74.006']).toBeDefined();
      expect(result['34.0522,-118.2437']).toBeDefined();

      // Validate structure
      expect(result['40.7128,-74.006']['40.7128,-74.006']).toEqual({ time: 0, distance: 0 });
      expect(result['40.7128,-74.006']['34.0522,-118.2437']).toEqual({
        time: 14400,
        distance: 4500000,
      });
      expect(result['34.0522,-118.2437']['40.7128,-74.006']).toEqual({
        time: 14400,
        distance: 4500000,
      });
      expect(result['34.0522,-118.2437']['34.0522,-118.2437']).toEqual({ time: 0, distance: 0 });

      // Validate with Zod schema
      expect(() => CoordinateMatrixSchema.parse(result)).not.toThrow();
    });

    it('should make GET request to correct URL with coordinate string', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.mapbox.com/directions-matrix/v1/mapbox/driving/-74.006,40.7128;-118.2437,34.0522?annotations=duration,distance&access_token=test-mapbox-api-key',
        ),
      );
    });

    it('should handle single origin/destination correctly', async () => {
      // Arrange
      const singleQuery: MatrixQuery = {
        origins: [{ lat: 40.7128, lng: -74.006 }],
      };
      const singleResponse = {
        data: {
          durations: [[0]],
          distances: [[0]],
          code: 'Ok',
        },
      };
      const mockAxiosResponse: AxiosResponse = {
        ...singleResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const result = await service.getMatrixRouting(singleQuery);

      // Assert
      expect(result['40.7128,-74.006']['40.7128,-74.006']).toEqual({ time: 0, distance: 0 });
    });

    it('should throw BadGatewayException on HTTP error', async () => {
      // Arrange
      const error = new Error('Network error');
      httpService.get.mockReturnValueOnce(throwError(() => error));

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(BadGatewayException);
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(
        'Failed to fetch matrix routing from Mapbox',
      );
    });

    it('should handle malformed API response gracefully', async () => {
      // Arrange
      const malformedResponse = {
        data: {
          // Missing required fields
          code: 'Ok',
        },
      };
      const mockAxiosResponse: AxiosResponse = {
        ...malformedResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act & Assert
      // This should either handle gracefully or throw appropriate error
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow();
    });
  });

  describe('mapMatrixResponseToCoordinateMatrix', () => {
    it('should correctly map 2D arrays to coordinate matrix', () => {
      // Arrange
      const origins = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 34.0522, lng: -118.2437 },
      ];
      const travelTimes = [
        [0, 14400],
        [14400, 0],
      ];
      const distances = [
        [0, 4500000],
        [4500000, 0],
      ];

      // Act
      const result = service.mapMatrixResponseToCoordinateMatrix({
        origins,
        travelTimes,
        distances,
      });

      // Assert
      expect(result['40.7128,-74.006']['40.7128,-74.006']).toEqual({ time: 0, distance: 0 });
      expect(result['40.7128,-74.006']['34.0522,-118.2437']).toEqual({
        time: 14400,
        distance: 4500000,
      });
      expect(result['34.0522,-118.2437']['40.7128,-74.006']).toEqual({
        time: 14400,
        distance: 4500000,
      });
      expect(result['34.0522,-118.2437']['34.0522,-118.2437']).toEqual({ time: 0, distance: 0 });
    });

    it('should handle 3x3 matrix correctly', () => {
      // Arrange
      const origins = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 34.0522, lng: -118.2437 },
        { lat: 41.8781, lng: -87.6298 }, // Chicago
      ];
      const travelTimes = [
        [0, 14400, 7200], // NY to [NY, LA, Chicago]
        [14400, 0, 10800], // LA to [NY, LA, Chicago]
        [7200, 10800, 0], // Chicago to [NY, LA, Chicago]
      ];
      const distances = [
        [0, 4500000, 1200000],
        [4500000, 0, 3000000],
        [1200000, 3000000, 0],
      ];

      // Act
      const result = service.mapMatrixResponseToCoordinateMatrix({
        origins,
        travelTimes,
        distances,
      });

      // Assert
      expect(Object.keys(result)).toHaveLength(3);
      expect(result['40.7128,-74.006']['41.8781,-87.6298']).toEqual({
        time: 7200,
        distance: 1200000,
      });
      expect(result['41.8781,-87.6298']['34.0522,-118.2437']).toEqual({
        time: 10800,
        distance: 3000000,
      });
    });

    it('should validate result with Zod schema', () => {
      // Arrange
      const origins = [{ lat: 40.7128, lng: -74.006 }];
      const travelTimes = [[0]];
      const distances = [[0]];

      // Act
      const result = service.mapMatrixResponseToCoordinateMatrix({
        origins,
        travelTimes,
        distances,
      });

      // Assert
      expect(() => CoordinateMatrixSchema.parse(result)).not.toThrow();
    });
  });

  describe('buildMapboxOriginsParam', () => {
    it('should format coordinates correctly for Mapbox API', () => {
      // Arrange
      const coordinates = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 34.0522, lng: -118.2437 },
      ];

      // Act
      const result = service.buildMapboxOriginsParam(coordinates);

      // Assert
      expect(result).toBe('-74.006,40.7128;-118.2437,34.0522');
    });

    it('should handle single coordinate', () => {
      // Arrange
      const coordinates = [{ lat: 40.7128, lng: -74.006 }];

      // Act
      const result = service.buildMapboxOriginsParam(coordinates);

      // Assert
      expect(result).toBe('-74.006,40.7128');
    });

    it('should handle multiple coordinates', () => {
      // Arrange
      const coordinates = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 34.0522, lng: -118.2437 },
        { lat: 41.8781, lng: -87.6298 },
      ];

      // Act
      const result = service.buildMapboxOriginsParam(coordinates);

      // Assert
      expect(result).toBe('-74.006,40.7128;-118.2437,34.0522;-87.6298,41.8781');
    });

    it('should handle coordinates with more decimal places', () => {
      // Arrange
      const coordinates = [{ lat: 40.712776, lng: -74.005974 }];

      // Act
      const result = service.buildMapboxOriginsParam(coordinates);

      // Assert
      expect(result).toBe('-74.005974,40.712776');
    });
  });

  describe('Configuration Errors', () => {
    it('should throw InternalServerErrorException if MAPBOX_API_KEY is missing', async () => {
      // This test creates a new service instance with missing API key
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxMatrixRoutingAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockReturnValueOnce(null) // MAPBOX_API_KEY
                .mockReturnValueOnce('https://api.mapbox.com'), // MAPBOX_BASE_URL
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

    it('should throw InternalServerErrorException if MAPBOX_BASE_URL is missing', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxMatrixRoutingAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockReturnValueOnce('test-api-key') // MAPBOX_API_KEY
                .mockReturnValueOnce(null), // MAPBOX_BASE_URL
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

    it('should throw correct error message for missing API key', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxMatrixRoutingAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockReturnValueOnce(undefined) // MAPBOX_API_KEY
                .mockReturnValueOnce('https://api.mapbox.com'), // MAPBOX_BASE_URL
            },
          },
          {
            provide: HttpService,
            useValue: httpService,
          },
        ],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow('MAPBOX_API_KEY is not set');
    });

    it('should throw correct error message for missing base URL', async () => {
      const moduleBuilder = Test.createTestingModule({
        providers: [
          MapboxMatrixRoutingAdapterService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockReturnValueOnce('test-api-key') // MAPBOX_API_KEY
                .mockReturnValueOnce(undefined), // MAPBOX_BASE_URL
            },
          },
          {
            provide: HttpService,
            useValue: httpService,
          },
        ],
      });

      await expect(moduleBuilder.compile()).rejects.toThrow('MAPBOX_BASE_URL is not set');
    });
  });

  describe('URL construction', () => {
    it('should construct correct matrix URL with coordinates', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockMapboxResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('directions-matrix/v1/mapbox/driving/'),
      );
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('-74.006,40.7128;-118.2437,34.0522'),
      );
      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('access_token=test-mapbox-api-key'),
      );
    });
  });

  describe('error scenarios', () => {
    it('should handle Mapbox API error responses', async () => {
      // Arrange
      const errorResponse = {
        data: {
          code: 'InvalidInput',
          message: 'Invalid coordinate',
        },
      };
      const mockAxiosResponse: AxiosResponse = {
        ...errorResponse,
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse));

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      // Arrange
      const timeoutError = new Error('ECONNABORTED');
      httpService.get.mockReturnValueOnce(throwError(() => timeoutError));

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(BadGatewayException);
    });
  });
});

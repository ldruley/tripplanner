import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HereMatrixRoutingAdapterService } from './here-matrix-routing-adapter.service';
import { InternalServerErrorException, BadGatewayException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { createMockLogger, mockLoggerClass, restoreLoggerClass } from '@trip-planner/test-utils';
import { MatrixQuery, CoordinateMatrix, CoordinateMatrixSchema } from '@trip-planner/types';

describe('HereMatrixRoutingAdapterService', () => {
  let service: HereMatrixRoutingAdapterService;
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

  // HERE API returns flat arrays for matrix data
  const mockHereResponse = {
    data: {
      matrix: {
        numOrigins: 2,
        numDestinations: 2,
        travelTimes: [0, 14400, 14400, 0], // Flat array: [origin0->dest0, origin0->dest1, origin1->dest0, origin1->dest1]
        distances: [0, 4500000, 4500000, 0], // Distances in meters
      },
    },
  };

  beforeEach(async () => {
    httpService = mock<HttpService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HereMatrixRoutingAdapterService,
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

    service = module.get<HereMatrixRoutingAdapterService>(HereMatrixRoutingAdapterService);
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

  describe('getMatrixRouting', () => {
    it('should successfully get matrix routing data', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockHereResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

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

    it('should make POST request to correct URL with proper body', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockHereResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('matrix.router.hereapi.com'),
        {
          origins: mockMatrixQuery.origins,
          regionDefinition: { type: 'world' },
          matrixAttributes: ['travelTimes', 'distances'],
        },
        {
          params: {
            apiKey: 'test-here-api-key',
            async: false,
          },
        },
      );
    });

    it('should handle single origin/destination correctly', async () => {
      // Arrange
      const singleQuery: MatrixQuery = {
        origins: [{ lat: 40.7128, lng: -74.006 }],
      };
      const singleResponse = {
        data: {
          matrix: {
            numOrigins: 1,
            numDestinations: 1,
            travelTimes: [0],
            distances: [0],
          },
        },
      };
      const mockAxiosResponse: AxiosResponse = {
        ...singleResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      const result = await service.getMatrixRouting(singleQuery);

      // Assert
      expect(result['40.7128,-74.006']['40.7128,-74.006']).toEqual({ time: 0, distance: 0 });
    });

    it('should throw BadGatewayException on HTTP error', async () => {
      // Arrange
      const error = new Error('Network error');
      httpService.post.mockReturnValueOnce(throwError(() => error));

      // Act & Assert
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(BadGatewayException);
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow(
        'Failed to fetch matrix data from HERE API',
      );
    });

    it('should handle malformed API response gracefully', async () => {
      // Arrange
      const malformedResponse = {
        data: {
          matrix: {
            // Missing required fields
          },
        },
      };
      const mockAxiosResponse: AxiosResponse = {
        ...malformedResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

      // Act & Assert
      // This should either handle gracefully or throw appropriate error
      await expect(service.getMatrixRouting(mockMatrixQuery)).rejects.toThrow();
    });
  });

  describe('mapMatrixResponseToCoordinateMatrix', () => {
    it('should correctly map flat arrays to coordinate matrix', () => {
      // Arrange
      const origins = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 34.0522, lng: -118.2437 },
      ];
      const travelTimes = [0, 14400, 14400, 0];
      const distances = [0, 4500000, 4500000, 0];

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
      // 3x3 matrix flattened: [0,0] [0,1] [0,2] [1,0] [1,1] [1,2] [2,0] [2,1] [2,2]
      const travelTimes = [0, 14400, 7200, 14400, 0, 10800, 7200, 10800, 0];
      const distances = [0, 4500000, 1200000, 4500000, 0, 3000000, 1200000, 3000000, 0];

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
      const travelTimes = [0];
      const distances = [0];

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

  describe('Configuration Errors', () => {
    it('should throw InternalServerErrorException if HERE_API_KEY is missing', async () => {
      // This test creates a new service instance with missing API key
      const moduleBuilder = Test.createTestingModule({
        providers: [
          HereMatrixRoutingAdapterService,
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
          HereMatrixRoutingAdapterService,
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

      await expect(moduleBuilder.compile()).rejects.toThrow('HERE_API_KEY is required');
    });
  });

  describe('URL construction', () => {
    it('should construct correct matrix URL', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockHereResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('https://matrix.router.hereapi.com/v8/matrix?async=false/matrix'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should include async=false parameter', async () => {
      // Arrange
      const mockAxiosResponse: AxiosResponse = {
        ...mockHereResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.post.mockReturnValueOnce(of(mockAxiosResponse));

      // Act
      await service.getMatrixRouting(mockMatrixQuery);

      // Assert
      expect(httpService.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
        params: expect.objectContaining({
          async: false,
        }),
      });
    });
  });
});

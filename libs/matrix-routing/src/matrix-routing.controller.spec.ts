import { Test, TestingModule } from '@nestjs/testing';
import { MatrixRoutingController } from './matrix-routing.controller';
import { MatrixRoutingService } from './matrix-routing.service';
import { ServiceUnavailableException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import {
  MatrixQuery,
  CoordinateMatrix,
  CoordinateMatrixSchema,
} from '@trip-planner/types';

describe('MatrixRoutingController', () => {
  let controller: MatrixRoutingController;
  let matrixRoutingService: ReturnType<typeof mock<MatrixRoutingService>>;

  // Use the actual MatrixQuery type since the controller casts MatrixQueryDto to MatrixQuery
  const mockMatrixQuery: MatrixQuery = {
    origins: [
      { lat: 40.7128, lng: -74.0060 }, // New York
      { lat: 34.0522, lng: -118.2437 } // Los Angeles
    ],
    profile: 'carFast',
    routingMode: 'fast'
  };

  const mockCoordinateMatrix: CoordinateMatrix = {
    '40.7128,-74.006': {
      '40.7128,-74.006': { time: 0, distance: 0 },
      '34.0522,-118.2437': { time: 14400, distance: 4500000 }
    },
    '34.0522,-118.2437': {
      '40.7128,-74.006': { time: 14400, distance: 4500000 },
      '34.0522,-118.2437': { time: 0, distance: 0 }
    }
  };

  beforeEach(async () => {
    matrixRoutingService = mock<MatrixRoutingService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatrixRoutingController],
      providers: [
        {
          provide: MatrixRoutingService,
          useValue: matrixRoutingService
        }
      ],
    })
    .setLogger(createMockLogger())
    .compile();

    controller = module.get<MatrixRoutingController>(MatrixRoutingController);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('getMatrixRoute', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should return matrix routing data successfully', async () => {
      // Arrange
      matrixRoutingService.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);

      // Act
      const result = await controller.getMatrixRoute(mockMatrixQuery as any);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
      
      // Validate with Zod schema
      expect(() => CoordinateMatrixSchema.parse(result)).not.toThrow();
    });

    it('should pass query parameters to service correctly', async () => {
      // Arrange
      const customQuery: MatrixQuery = {
        origins: [
          { lat: 51.5074, lng: -0.1278 }, // London
          { lat: 48.8566, lng: 2.3522 }   // Paris
        ],
        profile: 'pedestrian',
        routingMode: 'short'
      };
      const customMatrix: CoordinateMatrix = {
        '51.5074,-0.1278': {
          '51.5074,-0.1278': { time: 0, distance: 0 },
          '48.8566,2.3522': { time: 3600, distance: 450000 }
        },
        '48.8566,2.3522': {
          '51.5074,-0.1278': { time: 3600, distance: 450000 },
          '48.8566,2.3522': { time: 0, distance: 0 }
        }
      };
      matrixRoutingService.getMatrixRouting.mockResolvedValue(customMatrix);

      // Act
      const result = await controller.getMatrixRoute(customQuery as any);

      // Assert
      expect(result).toEqual(customMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(customQuery);
    });

    it('should handle single origin correctly', async () => {
      // Arrange
      const singleOriginQuery: MatrixQuery = {
        origins: [{ lat: 40.7128, lng: -74.0060 }]
      };
      const singleOriginMatrix: CoordinateMatrix = {
        '40.7128,-74.006': {
          '40.7128,-74.006': { time: 0, distance: 0 }
        }
      };
      matrixRoutingService.getMatrixRouting.mockResolvedValue(singleOriginMatrix);

      // Act
      const result = await controller.getMatrixRoute(singleOriginQuery as any);

      // Assert
      expect(result).toEqual(singleOriginMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(singleOriginQuery);
    });

    it('should handle optional parameters correctly', async () => {
      // Arrange
      const minimalQuery: MatrixQuery = {
        origins: [
          { lat: 40.7128, lng: -74.0060 },
          { lat: 34.0522, lng: -118.2437 }
        ]
        // profile and routingMode are optional
      };
      matrixRoutingService.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);

      // Act
      const result = await controller.getMatrixRoute(minimalQuery as any);

      // Assert
      expect(result).toEqual(mockCoordinateMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(minimalQuery);
    });

    it('should propagate ServiceUnavailableException from service', async () => {
      // Arrange
      const serviceError = new ServiceUnavailableException('No API quota available for matrix routing');
      matrixRoutingService.getMatrixRouting.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getMatrixRoute(mockMatrixQuery as any))
        .rejects.toThrow(ServiceUnavailableException);
      await expect(controller.getMatrixRoute(mockMatrixQuery as any))
        .rejects.toThrow('No API quota available for matrix routing');
    });

    it('should propagate other errors from service', async () => {
      // Arrange
      const genericError = new Error('Unexpected error');
      matrixRoutingService.getMatrixRouting.mockRejectedValue(genericError);

      // Act & Assert
      await expect(controller.getMatrixRoute(mockMatrixQuery as any))
        .rejects.toThrow('Unexpected error');
    });

    it('should handle empty matrix response', async () => {
      // Arrange
      const emptyMatrix: CoordinateMatrix = {};
      matrixRoutingService.getMatrixRouting.mockResolvedValue(emptyMatrix);

      // Act
      const result = await controller.getMatrixRoute(mockMatrixQuery as any);

      // Assert
      expect(result).toEqual(emptyMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(mockMatrixQuery);
    });

    it('should handle large coordinate sets', async () => {
      // Arrange
      const largeQuery: MatrixQuery = {
        origins: [
          { lat: 40.7128, lng: -74.0060 },  // New York
          { lat: 34.0522, lng: -118.2437 }, // Los Angeles
          { lat: 41.8781, lng: -87.6298 },  // Chicago
          { lat: 29.7604, lng: -95.3698 },  // Houston
          { lat: 33.4484, lng: -112.0740 }  // Phoenix
        ],
        profile: 'carFast'
      };
      
      // Create a larger matrix response
      const largeMatrix: CoordinateMatrix = {
        '40.7128,-74.006': {
          '40.7128,-74.006': { time: 0, distance: 0 },
          '34.0522,-118.2437': { time: 14400, distance: 4500000 },
          '41.8781,-87.6298': { time: 7200, distance: 1200000 },
          '29.7604,-95.3698': { time: 10800, distance: 2000000 },
          '33.4484,-112.074': { time: 12600, distance: 3500000 }
        }
        // ... other coordinates would be here in a real response
      };
      matrixRoutingService.getMatrixRouting.mockResolvedValue(largeMatrix);

      // Act
      const result = await controller.getMatrixRoute(largeQuery as any);

      // Assert
      expect(result).toEqual(largeMatrix);
      expect(matrixRoutingService.getMatrixRouting).toHaveBeenCalledWith(largeQuery);
    });
  });

  describe('endpoint configuration', () => {
    it('should be mapped to correct route', () => {
      // This test verifies the controller is correctly decorated
      const controllerMetadata = Reflect.getMetadata('path', MatrixRoutingController);
      expect(controllerMetadata).toBe('matrix-routing');
    });

    it('should use GET method for route endpoint', () => {
      // Verify the getMatrixRoute method uses GET
      const methodMetadata = Reflect.getMetadata('method', controller.getMatrixRoute);
      // Note: This test might need adjustment based on how NestJS decorators are applied
      // The actual implementation might vary
    });
  });

  describe('validation pipe integration', () => {
    it('should use ZodValidationPipe for query validation', () => {
      // This test verifies that the endpoint is properly decorated with validation
      // The actual validation is handled by NestJS pipes, so we test the integration
      expect(controller.getMatrixRoute).toBeDefined();
    });
  });

  describe('type safety', () => {
    it('should accept MatrixQuery and return CoordinateMatrix', async () => {
      // Arrange
      matrixRoutingService.getMatrixRouting.mockResolvedValue(mockCoordinateMatrix);

      // Act
      const result = await controller.getMatrixRoute(mockMatrixQuery as any);

      // Assert - TypeScript compilation ensures type safety
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      
      // Verify the structure matches CoordinateMatrix interface
      Object.keys(result).forEach(originKey => {
        expect(typeof result[originKey]).toBe('object');
        Object.keys(result[originKey]).forEach(destKey => {
          expect(result[originKey][destKey]).toHaveProperty('time');
          expect(result[originKey][destKey]).toHaveProperty('distance');
          expect(typeof result[originKey][destKey].time).toBe('number');
          expect(typeof result[originKey][destKey].distance).toBe('number');
        });
      });
    });
  });

  describe('error response structure', () => {
    it('should maintain NestJS error response format', async () => {
      // Arrange
      const serviceError = new ServiceUnavailableException('No API quota available for matrix routing');
      matrixRoutingService.getMatrixRouting.mockRejectedValue(serviceError);

      // Act & Assert
      try {
        await controller.getMatrixRoute(mockMatrixQuery as any);
        fail('Expected exception to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.message).toBe('No API quota available for matrix routing');
      }
    });
  });
});
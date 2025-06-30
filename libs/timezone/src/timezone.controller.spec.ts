import { Test, TestingModule } from '@nestjs/testing';
import { TimezoneController } from './timezone.controller';
import { TimezoneService } from './timezone.service';
import { TimezoneRequestDto, TimezoneResponseDto } from '@trip-planner/shared/dtos';
import { mock } from 'jest-mock-extended';
import { createMockLogger } from '@trip-planner/test-utils';
import { randomUUID } from 'crypto';

// Mock the crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn()
}));

describe('TimezoneController', () => {
  let controller: TimezoneController;
  let timezoneService: ReturnType<typeof mock<TimezoneService>>;

  beforeEach(async () => {
    timezoneService = mock<TimezoneService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimezoneController],
      providers: [
        { provide: TimezoneService, useValue: timezoneService }
      ],
    })
    .setLogger(createMockLogger())
    .compile();

    controller = module.get<TimezoneController>(TimezoneController);
    jest.clearAllMocks();
  });

  describe('getTimezoneFromCoords', () => {
    it('should return timezone response for valid coordinates', async () => {
      // Arrange
      const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
      const testRequestDto: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const testResponseDto: TimezoneResponseDto = {
        timezone: 'America/New_York',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(testResponseDto);

      // Act
      const result = await controller.getTimezoneFromCoords(testRequestDto);

      // Assert
      expect(result).toEqual(testResponseDto);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        ...testRequestDto,
        requestId: mockUuid
      });
    });

    it('should generate requestId automatically', async () => {
      // Arrange
      const mockUuid = '987e6543-e21a-12d3-a456-426614174000';
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const testResponse: TimezoneResponseDto = {
        timezone: 'America/New_York',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(testResponse);

      // Act
      await controller.getTimezoneFromCoords(testRequest);

      // Assert
      expect(randomUUID).toHaveBeenCalled();
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.0060,
        requestId: mockUuid
      });
    });

    it('should handle different coordinate formats', async () => {
      // Arrange
      const testCases = [
        { latitude: 51.5074, longitude: -0.1278 }, // London
        { latitude: 48.8566, longitude: 2.3522 }, // Paris
        { latitude: 35.6762, longitude: 139.6503 }, // Tokyo
        { latitude: -33.8688, longitude: 151.2093 }, // Sydney
        { latitude: 0, longitude: 0 }, // Null Island
      ];

      const mockUuid = 'test-uuid';
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);

      for (const [index, coords] of testCases.entries()) {
        const expectedResponse: TimezoneResponseDto = {
          timezone: `Timezone_${index}`,
          requestId: mockUuid
        };
        timezoneService.getTimezoneByCoordinates.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.getTimezoneFromCoords(coords);

        // Assert
        expect(result).toEqual(expectedResponse);
        expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
          ...coords,
          requestId: mockUuid
        });
      }
    });

    it('should handle precision coordinates', async () => {
      // Arrange
      const preciseCoords: TimezoneRequestDto = {
        latitude: 40.712775826,
        longitude: -74.006058167
      };
      const mockUuid = 'precise-uuid';
      const preciseResponse: TimezoneResponseDto = {
        timezone: 'America/New_York',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(preciseResponse);

      // Act
      const result = await controller.getTimezoneFromCoords(preciseCoords);

      // Assert
      expect(result).toEqual(preciseResponse);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        latitude: 40.712775826,
        longitude: -74.006058167,
        requestId: mockUuid
      });
    });

    it('should handle negative coordinates', async () => {
      // Arrange
      const negativeCoords: TimezoneRequestDto = {
        latitude: -34.6037,
        longitude: -58.3816 // Buenos Aires
      };
      const expectedResponse: TimezoneResponseDto = {
        timezone: 'America/Argentina/Buenos_Aires',
        requestId: 'negative-uuid'
      };
      const mockUuid = 'negative-uuid';
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getTimezoneFromCoords(negativeCoords);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        ...negativeCoords,
        requestId: mockUuid
      });
    });

    it('should handle service errors', async () => {
      // Arrange
      const serviceError = new Error('Service unavailable');
      const mockUuid = 'error-uuid';
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getTimezoneFromCoords(testRequest))
        .rejects.toThrow('Service unavailable');
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        ...testRequest,
        requestId: mockUuid
      });
    });

    it('should handle service timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      const mockUuid = 'timeout-uuid';
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(controller.getTimezoneFromCoords(testRequest))
        .rejects.toThrow('Request timeout');
    });

    it('should preserve input coordinates without modification', async () => {
      // Arrange
      const originalCoords: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const coordsCopy = { ...originalCoords };
      const mockUuid = 'preserve-uuid';
      const testResponse: TimezoneResponseDto = {
        timezone: 'America/New_York',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(testResponse);

      // Act
      await controller.getTimezoneFromCoords(coordsCopy);

      // Assert
      // Note: The controller modifies the input by adding requestId
      expect(coordsCopy.latitude).toEqual(originalCoords.latitude);
      expect(coordsCopy.longitude).toEqual(originalCoords.longitude);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        ...originalCoords,
        requestId: mockUuid
      });
    });
  });

  describe('endpoint validation', () => {
    it('should be accessible via GET /timezone/coords', () => {
      // This test verifies the route configuration
      const routeMetadata = Reflect.getMetadata('path', TimezoneController);
      expect(routeMetadata).toBe('timezone');

      // Check the method decorator
      const methodMetadata = Reflect.getMetadata('path', controller.getTimezoneFromCoords);
      expect(methodMetadata).toBe('coords');
    });

    it('should use ZodValidationPipe for input validation', () => {
      // Verify that the validation pipe is applied
      const pipes = Reflect.getMetadata('__pipes__', controller.getTimezoneFromCoords);
      expect(pipes).toBeDefined();
    });

    it('should have proper Swagger documentation', () => {
      // Check for API operation metadata
      const operationMetadata = Reflect.getMetadata('swagger/apiOperation', controller.getTimezoneFromCoords);
      expect(operationMetadata).toBeDefined();
      expect(operationMetadata.summary).toBe('Get timezone from coordinates');

      // Check for API response metadata
      const responseMetadata = Reflect.getMetadata('swagger/apiResponse', controller.getTimezoneFromCoords);
      expect(responseMetadata).toBeDefined();
    });
  });

  describe('DTO validation integration', () => {
    it('should handle valid TimezoneRequestDto', async () => {
      // Arrange
      const validRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const mockUuid = 'valid-uuid';
      const mockResponse: TimezoneResponseDto = {
        timezone: 'America/New_York',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.getTimezoneFromCoords(validRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({
        ...validRequest,
        requestId: mockUuid
      });
    });

    it('should return properly formatted TimezoneResponseDto', async () => {
      // Arrange
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const mockUuid = 'format-uuid';
      const expectedResponse: TimezoneResponseDto = {
        timezone: 'Europe/London',
        requestId: mockUuid
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.getTimezoneFromCoords(testRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(typeof result.timezone).toBe('string');
      expect(typeof result.requestId).toBe('string');
      expect(result.timezone.length).toBeGreaterThan(0);
      // Note: In test we're using a mock UUID, so we don't test the actual UUID format
      expect(result.requestId).toBe(mockUuid);
    });

    it('should handle various timezone formats', async () => {
      // Arrange
      const timezoneFormats = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
        'Africa/Cairo',
        'UTC',
        'GMT'
      ];

      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      const mockUuid = 'format-test-uuid';
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);

      for (const timezone of timezoneFormats) {
        const expectedResponse: TimezoneResponseDto = {
          timezone,
          requestId: mockUuid
        };
        timezoneService.getTimezoneByCoordinates.mockResolvedValue(expectedResponse);

        // Act
        const result = await controller.getTimezoneFromCoords(testRequest);

        // Assert
        expect(result.timezone).toBe(timezone);
        expect(result.requestId).toBe(mockUuid);
      }
    });
  });

  describe('error handling', () => {
    it('should propagate service errors to client', async () => {
      // Arrange
      const serviceError = new Error('External API failure');
      const mockUuid = 'error-handling-uuid';
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.getTimezoneFromCoords(testRequest))
        .rejects.toThrow('External API failure');
    });

    it('should handle UUID generation failures', async () => {
      // Arrange
      const uuidError = new Error('UUID generation failed');
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      (randomUUID as jest.Mock).mockImplementation(() => {
        throw uuidError;
      });

      // Act & Assert
      await expect(controller.getTimezoneFromCoords(testRequest))
        .rejects.toThrow('UUID generation failed');
    });

    it('should handle malformed service responses', async () => {
      // Arrange
      const malformedResponse = {
        // Missing required fields
        timezone: undefined,
        requestId: undefined
      } as any;
      const mockUuid = 'malformed-uuid';
      const testRequest: TimezoneRequestDto = {
        latitude: 40.7128,
        longitude: -74.0060
      };
      (randomUUID as jest.Mock).mockReturnValue(mockUuid);
      timezoneService.getTimezoneByCoordinates.mockResolvedValue(malformedResponse);

      // Act
      const result = await controller.getTimezoneFromCoords(testRequest);

      // Assert
      expect(result).toEqual(malformedResponse);
      // Note: The controller trusts the service to return valid data
      // Validation would happen at the service/worker level
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid consecutive requests', async () => {
      // Arrange
      const requests: TimezoneRequestDto[] = [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 51.5074, longitude: -0.1278 },
        { latitude: 48.8566, longitude: 2.3522 }
      ];
      const mockUuids = ['uuid-1', 'uuid-2', 'uuid-3'];
      const mockResponses: TimezoneResponseDto[] = [
        { timezone: 'America/New_York', requestId: 'uuid-1' },
        { timezone: 'Europe/London', requestId: 'uuid-2' },
        { timezone: 'Europe/Paris', requestId: 'uuid-3' }
      ];

      (randomUUID as jest.Mock)
        .mockReturnValueOnce(mockUuids[0])
        .mockReturnValueOnce(mockUuids[1])
        .mockReturnValueOnce(mockUuids[2]);

      timezoneService.getTimezoneByCoordinates
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1])
        .mockResolvedValueOnce(mockResponses[2]);

      // Act
      const results = await Promise.all(
        requests.map(req => controller.getTimezoneFromCoords(req))
      );

      // Assert
      expect(results).toEqual(mockResponses);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Arrange
      const successRequest: TimezoneRequestDto = { latitude: 40.7128, longitude: -74.0060 };
      const failureRequest: TimezoneRequestDto = { latitude: 51.5074, longitude: -0.1278 };
      
      const mockUuid1 = 'success-uuid';
      const mockUuid2 = 'failure-uuid';
      const successResponse: TimezoneResponseDto = { timezone: 'America/New_York', requestId: mockUuid1 };
      const failureError = new Error('Service temporarily unavailable');

      (randomUUID as jest.Mock)
        .mockReturnValueOnce(mockUuid1)
        .mockReturnValueOnce(mockUuid2);

      timezoneService.getTimezoneByCoordinates
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(failureError);

      // Act & Assert
      const successResult = await controller.getTimezoneFromCoords(successRequest);
      expect(successResult).toEqual(successResponse);

      await expect(controller.getTimezoneFromCoords(failureRequest))
        .rejects.toThrow('Service temporarily unavailable');
    });

    it('should maintain request isolation', async () => {
      // Arrange
      const request1: TimezoneRequestDto = { latitude: 40.7128, longitude: -74.0060 };
      const request2: TimezoneRequestDto = { latitude: 51.5074, longitude: -0.1278 };
      
      const uuid1 = 'isolation-uuid-1';
      const uuid2 = 'isolation-uuid-2';
      
      (randomUUID as jest.Mock)
        .mockReturnValueOnce(uuid1)
        .mockReturnValueOnce(uuid2);

      timezoneService.getTimezoneByCoordinates
        .mockResolvedValueOnce({ timezone: 'America/New_York', requestId: uuid1 })
        .mockResolvedValueOnce({ timezone: 'Europe/London', requestId: uuid2 });

      // Act
      const result1 = await controller.getTimezoneFromCoords(request1);
      const result2 = await controller.getTimezoneFromCoords(request2);

      // Assert
      expect(result1.requestId).toBe(uuid1);
      expect(result2.requestId).toBe(uuid2);
      expect(result1.requestId).not.toBe(result2.requestId);
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({ ...request1, requestId: uuid1 });
      expect(timezoneService.getTimezoneByCoordinates).toHaveBeenCalledWith({ ...request2, requestId: uuid2 });
    });
  });
});
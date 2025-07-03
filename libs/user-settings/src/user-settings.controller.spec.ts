import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { DistanceUnit } from '@prisma/client';
import { SafeUser } from '@trip-planner/types';
import { CreateUserSettingsDto, UpdateUserSettingsDto } from '@trip-planner/shared/dtos';
import { createMockLogger } from '@trip-planner/test-utils';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsController', () => {
  let controller: UserSettingsController;
  let module: TestingModule;
  let mockService: {
    findByUserId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
  };

  const mockUser: SafeUser = {
    id: 'test-user-id-123',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    emailVerified: true,
  };

  const mockUserSettings = {
    id: 'settings-id-123',
    userId: mockUser.id,
    timezone: 'Europe/London',
    distanceUnit: DistanceUnit.MILES,
    darkMode: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockCreateDto: CreateUserSettingsDto = {
    userId: mockUser.id,
    timezone: 'America/New_York',
    distanceUnit: DistanceUnit.KILOMETERS,
    darkMode: true,
  };

  const mockUpdateDto: UpdateUserSettingsDto = {
    timezone: 'Europe/Paris',
    darkMode: false,
  };

  beforeEach(async () => {
    mockService = {
      findByUserId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [UserSettingsController],
      providers: [
        { provide: UserSettingsService, useValue: mockService },
      ],
    })
      .setLogger(createMockLogger())
      .compile();

    controller = module.get<UserSettingsController>(UserSettingsController);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('getSettings', () => {
    it('should return user settings when found', async () => {
      mockService.findByUserId.mockResolvedValue(mockUserSettings);

      const result = await controller.getSettings(mockUser);

      expect(result).toEqual(mockUserSettings);
      expect(mockService.findByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return null when user has no settings', async () => {
      mockService.findByUserId.mockResolvedValue(null);

      const result = await controller.getSettings(mockUser);

      expect(result).toBeNull();
      expect(mockService.findByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it('should propagate BadRequestException from service', async () => {
      const serviceError = new BadRequestException('Invalid user ID format');
      mockService.findByUserId.mockRejectedValue(serviceError);

      await expect(controller.getSettings(mockUser))
        .rejects.toThrow(BadRequestException);
      expect(mockService.findByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it('should propagate ServiceUnavailableException from service', async () => {
      const serviceError = new ServiceUnavailableException('Database unavailable');
      mockService.findByUserId.mockRejectedValue(serviceError);

      await expect(controller.getSettings(mockUser))
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('should handle unexpected errors from service', async () => {
      const unexpectedError = new Error('Unexpected service error');
      mockService.findByUserId.mockRejectedValue(unexpectedError);

      await expect(controller.getSettings(mockUser))
        .rejects.toThrow('Unexpected service error');
    });
  });

  describe('createSettings', () => {
    it('should create settings successfully', async () => {
      const expectedServiceCall = {
        userId: mockUser.id,
        timezone: mockCreateDto.timezone,
        distanceUnit: mockCreateDto.distanceUnit,
        darkMode: mockCreateDto.darkMode,
      };
      const createdSettings = { ...mockUserSettings, ...expectedServiceCall };

      mockService.create.mockResolvedValue(createdSettings);

      const result = await controller.createSettings(mockUser, mockCreateDto);

      expect(result).toEqual(createdSettings);
      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, mockCreateDto);
    });

    it('should create settings with minimum required data', async () => {
      const minimalDto: CreateUserSettingsDto = {
        userId: mockUser.id,
        timezone: 'America/New_York',
        distanceUnit: DistanceUnit.MILES,
        darkMode: false,
      };
      const createdSettings = {
        ...mockUserSettings,
        timezone: 'America/New_York',
      };

      mockService.create.mockResolvedValue(createdSettings);

      const result = await controller.createSettings(mockUser, minimalDto);

      expect(result).toEqual(createdSettings);
      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, minimalDto);
    });

    it('should propagate ConflictException when settings already exist', async () => {
      const conflictError = new ConflictException('User settings already exist');
      mockService.create.mockRejectedValue(conflictError);

      await expect(controller.createSettings(mockUser, mockCreateDto))
        .rejects.toThrow(ConflictException);
      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, mockCreateDto);
    });

    it('should propagate BadRequestException for invalid data', async () => {
      const validationError = new BadRequestException('Invalid timezone');
      mockService.create.mockRejectedValue(validationError);

      await expect(controller.createSettings(mockUser, mockCreateDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle service rejecting user ID mismatch', async () => {
      const mismatchDto = { ...mockCreateDto, userId: 'different-user-id' };

      // Service should still be called with the authenticated user's ID
      const createdSettings = { ...mockUserSettings, userId: mockUser.id };
      mockService.create.mockResolvedValue(createdSettings);

      const result = await controller.createSettings(mockUser, mismatchDto);

      // Controller passes the DTO as-is, service handles the userId override
      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, mismatchDto);
      expect(result.userId).toBe(mockUser.id);
    });
  });

  describe('updateSettings', () => {
    it('should update settings successfully', async () => {
      const updatedSettings = { ...mockUserSettings, ...mockUpdateDto };
      mockService.update.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(mockUser, mockUpdateDto);

      expect(result).toEqual(updatedSettings);
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });

    it('should update only provided fields', async () => {
      const partialUpdate: UpdateUserSettingsDto = { darkMode: true };
      const updatedSettings = { ...mockUserSettings, darkMode: true };

      mockService.update.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(mockUser, partialUpdate);

      expect(result).toEqual(updatedSettings);
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, partialUpdate);
    });

    it('should propagate NotFoundException when settings not found', async () => {
      const notFoundError = new NotFoundException('User settings not found');
      mockService.update.mockRejectedValue(notFoundError);

      await expect(controller.updateSettings(mockUser, mockUpdateDto))
        .rejects.toThrow(NotFoundException);
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });

    it('should handle timezone updates', async () => {
      const timezoneUpdate: UpdateUserSettingsDto = {
        timezone: 'Asia/Tokyo'
      };
      const updatedSettings = {
        ...mockUserSettings,
        timezone: 'Asia/Tokyo'
      };

      mockService.update.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(mockUser, timezoneUpdate);

      expect(result.timezone).toBe('Asia/Tokyo');
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, timezoneUpdate);
    });

    it('should handle distance unit updates', async () => {
      const distanceUpdate: UpdateUserSettingsDto = {
        distanceUnit: DistanceUnit.KILOMETERS
      };
      const updatedSettings = {
        ...mockUserSettings,
        distanceUnit: DistanceUnit.KILOMETERS
      };

      mockService.update.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(mockUser, distanceUpdate);

      expect(result.distanceUnit).toBe(DistanceUnit.KILOMETERS);
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, distanceUpdate);
    });
  });

  describe('upsertSettings', () => {
    it('should upsert settings successfully when creating new', async () => {
      const expectedSettings = { ...mockUserSettings, ...mockUpdateDto };
      mockService.upsert.mockResolvedValue(expectedSettings);

      const result = await controller.upsertSettings(mockUser, mockUpdateDto);

      expect(result).toEqual(expectedSettings);
      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });

    it('should upsert settings successfully when updating existing', async () => {
      const existingSettings = { ...mockUserSettings };
      const updatedSettings = { ...existingSettings, ...mockUpdateDto };

      mockService.upsert.mockResolvedValue(updatedSettings);

      const result = await controller.upsertSettings(mockUser, mockUpdateDto);

      expect(result).toEqual(updatedSettings);
      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });

    it('should handle complete settings replacement via upsert', async () => {
      const completeUpdate: UpdateUserSettingsDto = {
        timezone: 'Australia/Sydney',
        distanceUnit: DistanceUnit.KILOMETERS,
        darkMode: true,
      };
      const upsertedSettings = {
        ...mockUserSettings,
        ...completeUpdate
      };

      mockService.upsert.mockResolvedValue(upsertedSettings);

      const result = await controller.upsertSettings(mockUser, completeUpdate);

      expect(result).toEqual(upsertedSettings);
      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, completeUpdate);
    });

    it('should propagate BadRequestException from service', async () => {
      const serviceError = new BadRequestException('Invalid foreign key');
      mockService.upsert.mockRejectedValue(serviceError);

      await expect(controller.upsertSettings(mockUser, mockUpdateDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('authentication integration', () => {
    it('should use authenticated user ID for all operations', async () => {
      const operations = [
        () => controller.getSettings(mockUser),
        () => controller.createSettings(mockUser, mockCreateDto),
        () => controller.updateSettings(mockUser, mockUpdateDto),
        () => controller.upsertSettings(mockUser, mockUpdateDto),
      ];

      // Mock all service methods to return appropriate responses
      mockService.findByUserId.mockResolvedValue(mockUserSettings);
      mockService.create.mockResolvedValue(mockUserSettings);
      mockService.update.mockResolvedValue(mockUserSettings);
      mockService.upsert.mockResolvedValue(mockUserSettings);

      // Execute all operations
      for (const operation of operations) {
        await operation();
      }

      // Verify all service calls used the authenticated user's ID
      expect(mockService.findByUserId).toHaveBeenCalledWith(mockUser.id);
      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
    });

    it('should work with different user roles', async () => {
      const adminUser: SafeUser = {
        ...mockUser,
        id: 'admin-user-id',
        role: 'admin',
      };

      mockService.findByUserId.mockResolvedValue({
        ...mockUserSettings,
        userId: adminUser.id,
      });

      const result = await controller.getSettings(adminUser);

      expect(result?.userId).toBe(adminUser.id);
      expect(mockService.findByUserId).toHaveBeenCalledWith(adminUser.id);
    });
  });

  describe('error propagation', () => {
    it('should propagate BadRequestException from service in getSettings', async () => {
      const serviceError = new BadRequestException('Test error message');
      mockService.findByUserId.mockRejectedValue(serviceError);

      await expect(controller.getSettings(mockUser))
        .rejects.toThrow(BadRequestException);

      expect(mockService.findByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it('should propagate ConflictException from service in createSettings', async () => {
      const serviceError = new ConflictException('Test error message');
      mockService.create.mockRejectedValue(serviceError);

      await expect(controller.createSettings(mockUser, mockCreateDto))
        .rejects.toThrow(ConflictException);

      expect(mockService.create).toHaveBeenCalledWith(mockUser.id, mockCreateDto);
    });

    it('should propagate NotFoundException from service in updateSettings', async () => {
      const serviceError = new NotFoundException('Test error message');
      mockService.update.mockRejectedValue(serviceError);

      await expect(controller.updateSettings(mockUser, mockUpdateDto))
        .rejects.toThrow(NotFoundException);

      expect(mockService.update).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });

    it('should propagate ServiceUnavailableException from service in upsertSettings', async () => {
      const serviceError = new ServiceUnavailableException('Test error message');
      mockService.upsert.mockRejectedValue(serviceError);

      await expect(controller.upsertSettings(mockUser, mockUpdateDto))
        .rejects.toThrow(ServiceUnavailableException);

      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, mockUpdateDto);
    });
  });

  describe('integration workflows', () => {
    it('should complete full settings management workflow', async () => {
      // Step 1: Check if settings exist (should return null)
      mockService.findByUserId.mockResolvedValueOnce(null);
      const getResult1 = await controller.getSettings(mockUser);
      expect(getResult1).toBeNull();

      // Step 2: Create new settings
      const createdSettings = { ...mockUserSettings, ...mockCreateDto };
      mockService.create.mockResolvedValue(createdSettings);
      const createResult = await controller.createSettings(mockUser, mockCreateDto);
      expect(createResult).toEqual(createdSettings);

      // Step 3: Get settings again (should return created settings)
      mockService.findByUserId.mockResolvedValueOnce(createdSettings);
      const getResult2 = await controller.getSettings(mockUser);
      expect(getResult2).toEqual(createdSettings);

      // Step 4: Update settings
      const updatedSettings = { ...createdSettings, ...mockUpdateDto };
      mockService.update.mockResolvedValue(updatedSettings);
      const updateResult = await controller.updateSettings(mockUser, mockUpdateDto);
      expect(updateResult).toEqual(updatedSettings);

      // Step 5: Verify final state
      mockService.findByUserId.mockResolvedValueOnce(updatedSettings);
      const finalResult = await controller.getSettings(mockUser);
      expect(finalResult).toEqual(updatedSettings);

      // Verify all service calls
      expect(mockService.findByUserId).toHaveBeenCalledTimes(3);
      expect(mockService.create).toHaveBeenCalledTimes(1);
      expect(mockService.update).toHaveBeenCalledTimes(1);
    });

    it('should handle upsert workflow for new user', async () => {
      const upsertData: UpdateUserSettingsDto = {
        timezone: 'Europe/Berlin',
        distanceUnit: DistanceUnit.KILOMETERS,
        darkMode: true,
      };

      const upsertedSettings = {
        ...mockUserSettings,
        ...upsertData,
      };

      mockService.upsert.mockResolvedValue(upsertedSettings);

      const result = await controller.upsertSettings(mockUser, upsertData);

      expect(result).toEqual(upsertedSettings);
      expect(mockService.upsert).toHaveBeenCalledWith(mockUser.id, upsertData);
    });
  });
});

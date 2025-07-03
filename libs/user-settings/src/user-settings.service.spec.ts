import { Test, TestingModule } from '@nestjs/testing';
import { DistanceUnit } from '@prisma/client';
import { PrismaService } from '@trip-planner/prisma';
import { createMockLogger } from '@trip-planner/test-utils';
import { UserSettingsSchema, CreateUserSettings, UpdateUserSettings } from '@trip-planner/types';
import { UserSettingsService } from './user-settings.service';

describe('UserSettingsService', () => {
  let service: UserSettingsService;
  let module: TestingModule;
  let mockPrismaService: {
    userSettings: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
  };

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserSettings = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    userId: mockUserId,
    timezone: 'Europe/London',
    distanceUnit: DistanceUnit.MILES,
    darkMode: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockCreateData: CreateUserSettings = {
    userId: mockUserId, // Will be overridden by service
    timezone: 'America/New_York',
    distanceUnit: DistanceUnit.KILOMETERS,
    darkMode: true,
  };

  const mockUpdateData: UpdateUserSettings = {
    timezone: 'Europe/Paris',
    darkMode: false,
  };

  beforeEach(async () => {
    mockPrismaService = {
      userSettings: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
    };

    module = await Test.createTestingModule({
      providers: [UserSettingsService, { provide: PrismaService, useValue: mockPrismaService }],
    })
      .setLogger(createMockLogger())
      .compile();

    service = module.get<UserSettingsService>(UserSettingsService);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('findByUserId', () => {
    it('should return user settings when found', async () => {
      mockPrismaService.userSettings.findUnique.mockResolvedValue(mockUserSettings);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockUserSettings);
      expect(mockPrismaService.userSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should return null when user settings not found', async () => {
      mockPrismaService.userSettings.findUnique.mockResolvedValue(null);

      const result = await service.findByUserId(mockUserId);

      expect(result).toBeNull();
      expect(mockPrismaService.userSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should propagate Prisma errors as-is', async () => {
      const prismaError = new Error('Database connection failed');
      mockPrismaService.userSettings.findUnique.mockRejectedValue(prismaError);

      await expect(service.findByUserId(mockUserId)).rejects.toThrow('Database connection failed');
    });

    it('should validate result against schema when found', async () => {
      mockPrismaService.userSettings.findUnique.mockResolvedValue(mockUserSettings);

      const result = await service.findByUserId(mockUserId);

      expect(() => UserSettingsSchema.parse(result)).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create user settings successfully', async () => {
      const expectedCreateData = {
        ...mockCreateData,
        userId: mockUserId,
      };
      mockPrismaService.userSettings.create.mockResolvedValue({
        ...mockUserSettings,
        ...expectedCreateData,
      });

      const result = await service.create(mockUserId, mockCreateData);

      expect(mockPrismaService.userSettings.create).toHaveBeenCalledWith({
        data: expectedCreateData,
      });
      expect(result).toEqual(expect.objectContaining(expectedCreateData));
    });

    it('should create with provided timezone and defaults for other fields', async () => {
      const createData: CreateUserSettings = {
        userId: 'different-user-id', // Will be overridden
        timezone: 'America/New_York',
        distanceUnit: DistanceUnit.MILES,
        darkMode: false,
      };
      const expectedResult = {
        ...mockUserSettings,
        userId: mockUserId,
        timezone: 'America/New_York',
      };

      mockPrismaService.userSettings.create.mockResolvedValue(expectedResult);

      const result = await service.create(mockUserId, createData);

      expect(mockPrismaService.userSettings.create).toHaveBeenCalledWith({
        data: { ...createData, userId: mockUserId },
      });
      expect(result.timezone).toBe('America/New_York');
    });

    it('should propagate Prisma errors during create', async () => {
      const prismaError = { code: 'P2002', message: 'Unique constraint violation' };
      mockPrismaService.userSettings.create.mockRejectedValue(prismaError);

      await expect(service.create(mockUserId, mockCreateData)).rejects.toEqual(prismaError);
    });

    it('should validate created settings against schema', async () => {
      const createdSettings = { ...mockUserSettings, ...mockCreateData };
      mockPrismaService.userSettings.create.mockResolvedValue(createdSettings);

      const result = await service.create(mockUserId, mockCreateData);

      expect(() => UserSettingsSchema.parse(result)).not.toThrow();
    });
  });

  describe('update', () => {
    it('should update user settings successfully', async () => {
      const updatedSettings = { ...mockUserSettings, ...mockUpdateData };
      mockPrismaService.userSettings.update.mockResolvedValue(updatedSettings);

      const result = await service.update(mockUserId, mockUpdateData);

      expect(mockPrismaService.userSettings.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: mockUpdateData,
      });
      expect(result).toEqual(updatedSettings);
    });

    it('should update only provided fields', async () => {
      const partialUpdate = { darkMode: true };
      const updatedSettings = { ...mockUserSettings, darkMode: true };
      mockPrismaService.userSettings.update.mockResolvedValue(updatedSettings);

      const result = await service.update(mockUserId, partialUpdate);

      expect(mockPrismaService.userSettings.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: partialUpdate,
      });
      expect(result.darkMode).toBe(true);
      expect(result.timezone).toBe(mockUserSettings.timezone); // Unchanged
    });

    it('should propagate Prisma errors during update', async () => {
      const prismaError = { code: 'P2025', message: 'Record not found' };
      mockPrismaService.userSettings.update.mockRejectedValue(prismaError);

      await expect(service.update(mockUserId, mockUpdateData)).rejects.toEqual(prismaError);
    });

    it('should validate updated settings against schema', async () => {
      const updatedSettings = { ...mockUserSettings, ...mockUpdateData };
      mockPrismaService.userSettings.update.mockResolvedValue(updatedSettings);

      const result = await service.update(mockUserId, mockUpdateData);

      expect(() => UserSettingsSchema.parse(result)).not.toThrow();
    });

    it('should handle timezone validation', async () => {
      const invalidTimezone = { timezone: 'Invalid/Timezone' };
      const updatedSettings = { ...mockUserSettings, ...invalidTimezone };
      mockPrismaService.userSettings.update.mockResolvedValue(updatedSettings);

      await service.update(mockUserId, invalidTimezone);

      // Note: Timezone validation happens at DTO level, service just passes data through
      expect(mockPrismaService.userSettings.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: invalidTimezone,
      });
    });
  });

  describe('upsert', () => {
    it('should create new settings when none exist', async () => {
      const expectedData = { ...mockUpdateData, userId: mockUserId };
      const createdSettings = { ...mockUserSettings, ...expectedData };

      mockPrismaService.userSettings.upsert.mockResolvedValue(createdSettings);

      const result = await service.upsert(mockUserId, mockUpdateData);

      expect(mockPrismaService.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        create: expectedData,
        update: mockUpdateData,
      });
      expect(result).toEqual(createdSettings);
    });

    it('should update existing settings when they exist', async () => {
      const updatedSettings = { ...mockUserSettings, ...mockUpdateData };
      mockPrismaService.userSettings.upsert.mockResolvedValue(updatedSettings);

      const result = await service.upsert(mockUserId, mockUpdateData);

      expect(mockPrismaService.userSettings.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        create: { ...mockUpdateData, userId: mockUserId },
        update: mockUpdateData,
      });
      expect(result).toEqual(updatedSettings);
    });

    it('should propagate Prisma errors during upsert', async () => {
      const prismaError = { code: 'P2003', message: 'Foreign key constraint violation' };
      mockPrismaService.userSettings.upsert.mockRejectedValue(prismaError);

      await expect(service.upsert(mockUserId, mockUpdateData)).rejects.toEqual(prismaError);
    });

    it('should validate upserted settings against schema', async () => {
      const upsertedSettings = { ...mockUserSettings, ...mockUpdateData };
      mockPrismaService.userSettings.upsert.mockResolvedValue(upsertedSettings);

      const result = await service.upsert(mockUserId, mockUpdateData);

      expect(() => UserSettingsSchema.parse(result)).not.toThrow();
    });
  });

  describe('integration workflows', () => {
    it('should complete full settings lifecycle', async () => {
      // Create
      const createData = {
        userId: mockUserId,
        timezone: 'America/New_York',
        distanceUnit: DistanceUnit.KILOMETERS,
        darkMode: true,
      };
      const createdSettings = { ...mockUserSettings, ...createData };
      mockPrismaService.userSettings.create.mockResolvedValue(createdSettings);

      const createResult = await service.create(mockUserId, createData);
      expect(createResult).toEqual(createdSettings);

      // Update
      const updateData = { darkMode: false, timezone: 'Europe/Paris' };
      const updatedSettings = { ...createdSettings, ...updateData };
      mockPrismaService.userSettings.update.mockResolvedValue(updatedSettings);

      const updateResult = await service.update(mockUserId, updateData);
      expect(updateResult).toEqual(updatedSettings);

      // Find
      mockPrismaService.userSettings.findUnique.mockResolvedValue(updatedSettings);
      const findResult = await service.findByUserId(mockUserId);
      expect(findResult).toEqual(updatedSettings);

      // Verify all operations called Prisma correctly
      expect(mockPrismaService.userSettings.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userSettings.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.userSettings.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should handle settings with all distance units', async () => {
      for (const unit of Object.values(DistanceUnit)) {
        const settingsWithUnit = {
          ...mockUserSettings,
          distanceUnit: unit,
        };

        mockPrismaService.userSettings.create.mockResolvedValue(settingsWithUnit);

        const createData: CreateUserSettings = {
          userId: mockUserId,
          timezone: 'Europe/London',
          distanceUnit: unit,
          darkMode: false,
        };

        const result = await service.create(mockUserId, createData);

        expect(result.distanceUnit).toBe(unit);
        expect(() => UserSettingsSchema.parse(result)).not.toThrow();
      }
    });
  });

  describe('error handling', () => {
    it('should handle unexpected database errors gracefully', async () => {
      const unexpectedError = new Error('Unexpected database error');
      mockPrismaService.userSettings.findUnique.mockRejectedValue(unexpectedError);

      await expect(service.findByUserId(mockUserId)).rejects.toThrow('Unexpected database error');
    });
  });
});

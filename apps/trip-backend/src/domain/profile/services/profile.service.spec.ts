import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { ProfileRepository } from '../repositories/profile.repository';
import { PrismaService } from '@trip-planner/prisma';
import {
  CreateProfile,
  UpdateProfile,
  Profile,
  ProfileQuery,
  ProfilesListResponse,
  CreateProfileSchema,
  UpdateProfileSchema,
  ProfileQuerySchema,
} from '@trip-planner/types';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';

// Mock data
const mockProfileId = 'test-profile-id';
const mockProfileEmail = 'test@example.com';
const mockProfile: Profile = {
  id: mockProfileId,
  userId: 'test-user-id',
  email: mockProfileEmail,
  displayName: 'Test User',
  bio: 'Test bio',
  avatarUrl: 'http://example.com/avatar.png',
  location: 'Test City',
  dateOfBirth: new Date('1990-01-01'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProfileRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(), // Added for completeness, though not directly used by ProfileService create
};

const mockPrismaService = {}; // PrismaService is used in constructor but not directly in methods being tested here, can be an empty mock.

describe('ProfileService', () => {
  let service: ProfileService;
  let repository: ProfileRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: ProfileRepository,
          useValue: mockProfileRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    repository = module.get<ProfileRepository>(ProfileRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return a profile if found', async () => {
      mockProfileRepository.findById.mockResolvedValue(mockProfile);
      const result = await service.findById(mockProfileId);
      expect(result).toEqual(mockProfile);
      expect(mockProfileRepository.findById).toHaveBeenCalledWith(mockProfileId);
    });

    it('should throw NotFoundException if profile not found', async () => {
      mockProfileRepository.findById.mockResolvedValue(null);
      await expect(service.findById(mockProfileId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a profile if found by email', async () => {
      mockProfileRepository.findByEmail.mockResolvedValue(mockProfile);
      const result = await service.findByEmail(mockProfileEmail);
      expect(result).toEqual(mockProfile);
      expect(mockProfileRepository.findByEmail).toHaveBeenCalledWith(mockProfileEmail);
    });

    it('should return null if profile not found by email', async () => {
      mockProfileRepository.findByEmail.mockResolvedValue(null);
      const result = await service.findByEmail(mockProfileEmail);
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateData: UpdateProfile = { displayName: 'Updated Name' };

    it('should update and return the profile', async () => {
      const updatedProfile = { ...mockProfile, ...updateData };
      mockProfileRepository.findById.mockResolvedValue(mockProfile);
      mockProfileRepository.update.mockResolvedValue(updatedProfile);

      const result = await service.update(mockProfileId, updateData);
      expect(result).toEqual(updatedProfile);
      expect(mockProfileRepository.findById).toHaveBeenCalledWith(mockProfileId);
      expect(mockProfileRepository.update).toHaveBeenCalledWith(mockProfileId, updateData);
    });

    it('should throw NotFoundException if profile to update does not exist', async () => {
      mockProfileRepository.findById.mockResolvedValue(null);
      await expect(service.update(mockProfileId, updateData)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid update data (ZodError)', async () => {
      const invalidData: any = { email: 'not-an-email' }; // Assuming email is not in UpdateProfile or has specific format
      // For this to work, UpdateProfileSchema must be restrictive enough
      // We simulate ZodError by making parse throw it.
      const realUpdateProfileSchema = UpdateProfileSchema.parse;
      UpdateProfileSchema.parse = jest.fn().mockImplementation(() => {
        throw new ZodError([
          {
            code: 'invalid_string',
            message: 'Invalid email',
            path: ['email'],
            validation: 'email',
          },
        ]);
      });

      await expect(service.update(mockProfileId, invalidData)).rejects.toThrow(BadRequestException);
      UpdateProfileSchema.parse = realUpdateProfileSchema; // Restore original parse
    });

    it('should handle Prisma P2002 error (ConflictException)', async () => {
      mockProfileRepository.findById.mockResolvedValue(mockProfile);
      mockProfileRepository.update.mockRejectedValue({ code: 'P2002' });
      await expect(service.update(mockProfileId, updateData)).rejects.toThrow(ConflictException);
    });

    it('should handle Prisma P2025 error (NotFoundException)', async () => {
      mockProfileRepository.findById.mockResolvedValue(mockProfile); // Simulate it exists first
      mockProfileRepository.update.mockRejectedValue({ code: 'P2025' }); // Then update fails with P2025
      await expect(service.update(mockProfileId, updateData)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMany', () => {
    const query: ProfileQuery = { page: 1, limit: 10 };
    const mockProfilesList = {
      data: [mockProfile],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };
    const expectedResponse: ProfilesListResponse = {
      success: true,
      data: mockProfilesList,
      message: `Found ${mockProfilesList.total} profiles`,
    };

    it('should return a list of profiles', async () => {
      mockProfileRepository.findMany.mockResolvedValue(mockProfilesList);
      const result = await service.findMany(query);
      expect(result).toEqual(expectedResponse);
      expect(mockProfileRepository.findMany).toHaveBeenCalledWith(query);
    });

    it('should throw BadRequestException for invalid query parameters (ZodError)', async () => {
      const invalidQuery: any = { page: 'not-a-number' };
      const realProfileQuerySchema = ProfileQuerySchema.parse;
      ProfileQuerySchema.parse = jest.fn().mockImplementation(() => {
        throw new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['page'],
            message: 'Page must be a number',
          },
        ]);
      });
      await expect(service.findMany(invalidQuery)).rejects.toThrow(BadRequestException);
      ProfileQuerySchema.parse = realProfileQuerySchema; // Restore
    });

    it('should handle Prisma errors during findMany', async () => {
      mockProfileRepository.findMany.mockRejectedValue({ code: 'P2016' }); // Query interpretation error
      await expect(service.findMany(query)).rejects.toThrow(BadRequestException);
    });
  });

  describe('exists', () => {
    it('should return true if profile exists', async () => {
      mockProfileRepository.exists.mockResolvedValue(true);
      const result = await service.exists(mockProfileId);
      expect(result).toBe(true);
      expect(mockProfileRepository.exists).toHaveBeenCalledWith(mockProfileId);
    });

    it('should return false if profile does not exist', async () => {
      mockProfileRepository.exists.mockResolvedValue(false);
      const result = await service.exists(mockProfileId);
      expect(result).toBe(false);
    });
  });

  describe('handlePrismaError', () => {
    it('should return ConflictException for P2002', () => {
      const error = { code: 'P2002', message: 'Unique constraint failed' };
      // Accessing private method for testing purposes, consider if this is necessary or if behavior can be tested via public methods
      expect(() => {
        throw (service as any).handlePrismaError(error);
      }).toThrow(ConflictException);
    });

    it('should return NotFoundException for P2025', () => {
      const error = { code: 'P2025', message: 'Record not found' };
      expect(() => {
        throw (service as any).handlePrismaError(error);
      }).toThrow(NotFoundException);
    });

    it('should return BadRequestException for P2003', () => {
      const error = { code: 'P2003', message: 'Foreign key constraint failed' };
      expect(() => {
        throw (service as any).handlePrismaError(error);
      }).toThrow(BadRequestException);
    });
    it('should return BadRequestException for P2016', () => {
      const error = { code: 'P2016', message: 'Query interpretation error' };
      expect(() => {
        throw (service as any).handlePrismaError(error);
      }).toThrow(BadRequestException);
    });

    it('should return BadRequestException for other codes', () => {
      const error = { code: 'PXXXX', message: 'Some other Prisma error' };
      expect(() => {
        throw (service as any).handlePrismaError(error);
      }).toThrow(BadRequestException);
    });
  });
});

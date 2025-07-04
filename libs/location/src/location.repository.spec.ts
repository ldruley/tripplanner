import { Test, TestingModule } from '@nestjs/testing';
import { LocationRepository } from './location.repository';
import { PrismaService } from '@trip-planner/prisma';
import { CreateLocationRequest, LocationSearchCriteria } from './location.types';

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let prisma: PrismaService;

  const mockPrismaLocation = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Location',
    description: 'A test location',
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    postalCode: '12345',
    latitude: 40.7128,
    longitude: -74.0060,
    apiSource: 'USER_INPUT',
    category: 'RESTAURANT',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    location: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<LocationRepository>(LocationRepository);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService.location).forEach(mock => mock.mockReset());
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a location', async () => {
      const createRequest: CreateLocationRequest = {
        name: 'New Location',
        latitude: 40.7128,
        longitude: -74.0060,
        address: '123 New St',
        city: 'New York',
      };

      mockPrismaService.location.create.mockResolvedValue(mockPrismaLocation);

      const result = await repository.create(createRequest);

      expect(mockPrismaService.location.create).toHaveBeenCalledWith({
        data: {
          name: createRequest.name,
          description: null,
          address: createRequest.address,
          city: createRequest.city,
          state: null,
          country: null,
          postalCode: null,
          latitude: createRequest.latitude,
          longitude: createRequest.longitude,
          apiSource: null,
          apiSourceId: null,
          category: null,
          public: false,
        },
      });
      expect(result).toEqual(mockPrismaLocation);
    });
  });

  describe('findById', () => {
    it('should find location by ID', async () => {
      mockPrismaService.location.findUnique.mockResolvedValue(mockPrismaLocation);

      const result = await repository.findById(mockPrismaLocation.id);

      expect(mockPrismaService.location.findUnique).toHaveBeenCalledWith({
        where: { id: mockPrismaLocation.id },
      });
      expect(result).toEqual(mockPrismaLocation);
    });

    it('should return null when location not found', async () => {
      mockPrismaService.location.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByCoordinates', () => {
    it('should find locations within coordinate bounds', async () => {
      const latitude = 40.7128;
      const longitude = -74.0060;
      const radius = 1000;

      // Mock location within radius
      const nearbyLocation = {
        ...mockPrismaLocation,
        latitude: 40.7129, // Very close
        longitude: -74.0061,
      };

      mockPrismaService.location.findMany.mockResolvedValue([nearbyLocation]);

      const result = await repository.findByCoordinates(latitude, longitude, radius);

      expect(mockPrismaService.location.findMany).toHaveBeenCalled();
      expect(result).toEqual([nearbyLocation]);
    });

    it('should filter out locations outside radius using Haversine formula', async () => {
      const latitude = 40.7128;
      const longitude = -74.0060;
      const radius = 100; // 100 meters

      // Mock location far away (should be filtered out)
      const farLocation = {
        ...mockPrismaLocation,
        latitude: 40.8128, // ~11km away
        longitude: -74.0060,
      };

      mockPrismaService.location.findMany.mockResolvedValue([farLocation]);

      const result = await repository.findByCoordinates(latitude, longitude, radius);

      expect(result).toEqual([]); // Should be filtered out by Haversine calculation
    });
  });

  describe('findByNameAndAddress', () => {
    it('should find locations by name', async () => {
      mockPrismaService.location.findMany.mockResolvedValue([mockPrismaLocation]);

      const result = await repository.findByNameAndAddress('Test Location');

      expect(mockPrismaService.location.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Test Location',
            mode: 'insensitive',
          },
        },
      });
      expect(result).toEqual([mockPrismaLocation]);
    });

    it('should find locations by name and address', async () => {
      mockPrismaService.location.findMany.mockResolvedValue([mockPrismaLocation]);

      const result = await repository.findByNameAndAddress('Test Location', '123 Test St');

      expect(mockPrismaService.location.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Test Location',
            mode: 'insensitive',
          },
          OR: [
            {
              address: {
                contains: '123 Test St',
                mode: 'insensitive',
              },
            },
            {
              city: {
                contains: '123 Test St',
                mode: 'insensitive',
              },
            },
          ],
        },
      });
      expect(result).toEqual([mockPrismaLocation]);
    });
  });

  describe('search', () => {
    it('should search with multiple criteria', async () => {
      const criteria: LocationSearchCriteria = {
        name: 'Test',
        city: 'Test City',
        public: true,
        category: 'RESTAURANT',
      };

      mockPrismaService.location.findMany.mockResolvedValue([mockPrismaLocation]);

      const result = await repository.search(criteria);

      expect(mockPrismaService.location.findMany).toHaveBeenCalledWith({
        where: {
          name: {
            contains: 'Test',
            mode: 'insensitive',
          },
          city: {
            contains: 'Test City',
            mode: 'insensitive',
          },
          public: true,
          category: 'RESTAURANT',
        },
      });
      expect(result).toEqual([mockPrismaLocation]);
    });

    it('should search with coordinate radius', async () => {
      const criteria: LocationSearchCriteria = {
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 1000,
        },
      };

      // Mock nearby location
      const nearbyLocation = {
        ...mockPrismaLocation,
        latitude: 40.7129,
        longitude: -74.0061,
      };

      mockPrismaService.location.findMany.mockResolvedValue([nearbyLocation]);

      const result = await repository.search(criteria);

      expect(result).toEqual([nearbyLocation]);
    });
  });

  describe('update', () => {
    it('should update location', async () => {
      const updateData = {
        name: 'Updated Name',
        description: 'Updated Description',
      };

      const updatedLocation = { ...mockPrismaLocation, ...updateData };
      mockPrismaService.location.update.mockResolvedValue(updatedLocation);

      const result = await repository.update(mockPrismaLocation.id, updateData);

      expect(mockPrismaService.location.update).toHaveBeenCalledWith({
        where: { id: mockPrismaLocation.id },
        data: {
          name: updateData.name,
          description: updateData.description,
        },
      });
      expect(result).toEqual(updatedLocation);
    });
  });

  describe('delete', () => {
    it('should delete location', async () => {
      mockPrismaService.location.delete.mockResolvedValue(mockPrismaLocation);

      await repository.delete(mockPrismaLocation.id);

      expect(mockPrismaService.location.delete).toHaveBeenCalledWith({
        where: { id: mockPrismaLocation.id },
      });
    });
  });

  describe('findAll', () => {
    it('should return all locations ordered by creation date', async () => {
      mockPrismaService.location.findMany.mockResolvedValue([mockPrismaLocation]);

      const result = await repository.findAll();

      expect(mockPrismaService.location.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockPrismaLocation]);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates using Haversine formula', () => {
      // Test the private method through public method that uses it
      const lat1 = 40.7128; // NYC
      const lng1 = -74.0060;
      const lat2 = 40.7589; // Times Square
      const lng2 = -73.9851;

      // Create mock locations to test filtering
      const locations = [
        { ...mockPrismaLocation, latitude: lat2, longitude: lng2 },
      ];

      mockPrismaService.location.findMany.mockResolvedValue(locations);

      // Distance between these points is approximately 5.6 km
      // So with a 1000m radius, it should be filtered out
      return repository.findByCoordinates(lat1, lng1, 1000).then(result => {
        expect(result).toEqual([]); // Should be empty due to distance > radius
      });
    });
  });
});
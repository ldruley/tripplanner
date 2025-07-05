import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';
import { Location } from '@trip-planner/types';
import { LocationDeduplicationOptions } from './location.types';
import { CreateLocationRequest } from '@trip-planner/types';

describe('LocationService', () => {
  let service: LocationService;
  let repository: LocationRepository;

  const mockLocation: Location = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Location',
    description: 'A test location',
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    postalCode: '12345',
    latitude: 40.7128,
    longitude: -74.006,
    apiSource: 'USER_INPUT',
    apiSourceId: 'here-places-123',
    category: 'RESTAURANT',
    public: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByCoordinates: jest.fn(),
    findByNameAndAddress: jest.fn(),
    findByExactCoordinates: jest.fn(),
    findByApiSourceId: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        {
          provide: LocationRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    repository = module.get<LocationRepository>(LocationRepository);

    // Reset all mocks
    Object.values(mockRepository).forEach(mock => mock.mockReset());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createRequest: CreateLocationRequest = {
      name: 'New Location',
      latitude: 40.7128,
      longitude: -74.006,
      address: '123 New St',
      city: 'New York',
    };

    it('should create a new location when no duplicates found', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockLocation);

      const result = await service.create(createRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(createRequest);
      expect(result).toEqual(mockLocation);
    });

    it('should return existing location when coordinate duplicate found', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([mockLocation]);

      const result = await service.create(createRequest);

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockLocation);
    });

    it('should return existing location when API source duplicate found', async () => {
      const createRequestWithApi: CreateLocationRequest = {
        ...createRequest,
        apiSource: 'HERE',
        apiSourceId: 'google-123',
      };

      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([mockLocation]);

      const result = await service.create(createRequestWithApi);

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockLocation);
    });

    it('should create location when no duplicates found with disabled matching', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockLocation);

      const result = await service.create(createRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(createRequest);
      expect(result).toEqual(mockLocation);
    });

    it('should use custom deduplication options', async () => {
      const customOptions: LocationDeduplicationOptions = {
        enableExactCoordinateMatching: false,
      };

      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockLocation);

      await service.create(createRequest, customOptions);

      expect(mockRepository.findByExactCoordinates).not.toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(createRequest);
    });
  });

  describe('upsert', () => {
    const createRequest: CreateLocationRequest = {
      name: 'Updated Location',
      latitude: 40.7128,
      longitude: -74.006,
      description: 'Updated description',
    };

    it('should create new location when no duplicates found', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue(mockLocation);

      const result = await service.upsert(createRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(createRequest);
      expect(result).toEqual(mockLocation);
    });

    it('should update existing location when duplicate found', async () => {
      const existingLocation = { ...mockLocation, description: null };
      const updatedLocation = { ...mockLocation, description: 'Updated description' };

      mockRepository.findByExactCoordinates.mockResolvedValue([existingLocation]);
      mockRepository.update.mockResolvedValue(updatedLocation);

      const result = await service.upsert(createRequest);

      expect(mockRepository.update).toHaveBeenCalledWith(mockLocation.id, {
        description: createRequest.description,
      });
      expect(result).toEqual(updatedLocation);
    });
  });

  describe('findById', () => {
    it('should return location when found', async () => {
      mockRepository.findById.mockResolvedValue(mockLocation);

      const result = await service.findById(mockLocation.id);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockLocation.id);
      expect(result).toEqual(mockLocation);
    });

    it('should throw NotFoundException when location not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return search results', async () => {
      const searchCriteria = { name: 'Test', city: 'Test City' };
      const searchResults = [mockLocation];

      mockRepository.search.mockResolvedValue(searchResults);

      const result = await service.search(searchCriteria);

      expect(mockRepository.search).toHaveBeenCalledWith(searchCriteria);
      expect(result).toEqual(searchResults);
    });
  });

  describe('findNearby', () => {
    it('should return nearby locations with default radius', async () => {
      const nearbyLocations = [mockLocation];

      mockRepository.findByCoordinates.mockResolvedValue(nearbyLocations);

      const result = await service.findNearby(40.7128, -74.006);

      expect(mockRepository.findByCoordinates).toHaveBeenCalledWith(40.7128, -74.006, 1000);
      expect(result).toEqual(nearbyLocations);
    });

    it('should return nearby locations with custom radius', async () => {
      const nearbyLocations = [mockLocation];

      mockRepository.findByCoordinates.mockResolvedValue(nearbyLocations);

      const result = await service.findNearby(40.7128, -74.006, 500);

      expect(mockRepository.findByCoordinates).toHaveBeenCalledWith(40.7128, -74.006, 500);
      expect(result).toEqual(nearbyLocations);
    });
  });

  describe('update', () => {
    const updateData = { name: 'Updated Name', description: 'Updated Description' };

    it('should update location successfully', async () => {
      const updatedLocation = { ...mockLocation, ...updateData };

      mockRepository.findById.mockResolvedValue(mockLocation);
      mockRepository.update.mockResolvedValue(updatedLocation);

      const result = await service.update(mockLocation.id, updateData);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockLocation.id);
      expect(mockRepository.update).toHaveBeenCalledWith(mockLocation.id, updateData);
      expect(result).toEqual(updatedLocation);
    });

    it('should throw NotFoundException when location not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateData)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete location successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockLocation);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(mockLocation.id);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockLocation.id);
      expect(mockRepository.delete).toHaveBeenCalledWith(mockLocation.id);
    });

    it('should throw NotFoundException when location not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all locations', async () => {
      const allLocations = [mockLocation];

      mockRepository.findAll.mockResolvedValue(allLocations);

      const result = await service.findAll();

      expect(mockRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual(allLocations);
    });
  });

  describe('analyzeDuplicates', () => {
    const analyzeRequest: CreateLocationRequest = {
      name: 'Analyze Location',
      latitude: 40.7128,
      longitude: -74.006,
    };

    it('should return duplicate analysis without creating location', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([mockLocation]);

      const result = await service.analyzeDuplicates(analyzeRequest);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLocation).toEqual(mockLocation);
      expect(result.matchReason).toBe('exact_coordinates');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should return no duplicates found', async () => {
      mockRepository.findByExactCoordinates.mockResolvedValue([]);
      mockRepository.findByApiSourceId.mockResolvedValue([]);

      const result = await service.analyzeDuplicates(analyzeRequest);

      expect(result.isDuplicate).toBe(false);
      expect(result.existingLocation).toBeUndefined();
    });
  });
});

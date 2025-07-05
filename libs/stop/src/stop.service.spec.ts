import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { StopService } from './stop.service';
import { StopRepository } from './stop.repository';
import { Stop } from '@trip-planner/types';
import {
  CreateStopRequest,
  UpdateStopRequest,
  ReorderStopsRequest,
  BulkStopUpdateRequest,
  StopSearchCriteria,
  StopWithLocation,
} from './stop.types';

describe('StopService', () => {
  let service: StopService;
  let repository: StopRepository;

  const mockStop: Stop = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    tripId: 'trip-123',
    locationId: 'location-123',
    order: 0,
    plannedArrivalTime: new Date('2024-07-10T10:00:00Z'),
    plannedDuration: 60,
    calculatedArrivalTime: new Date('2024-07-10T10:00:00Z'),
    calculatedDepartureTime: new Date('2024-07-10T11:00:00Z'),
    stopType: 'PITSTOP',
    notes: 'Test stop notes',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStopWithLocation: StopWithLocation = {
    ...mockStop,
    location: {
      id: 'location-123',
      name: 'Test Location',
      address: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      country: 'Test Country',
      latitude: 40.7128,
      longitude: -74.0060,
    },
  };

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdWithLocation: jest.fn(),
    findByTripId: jest.fn(),
    findByTripIdWithLocations: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    updateOrder: jest.fn(),
    bulkUpdateOrders: jest.fn(),
    updateCalculatedTimes: jest.fn(),
    delete: jest.fn(),
    deleteByTripId: jest.fn(),
    getNextOrderForTrip: jest.fn(),
    getStopCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopService,
        {
          provide: StopRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<StopService>(StopService);
    repository = module.get<StopRepository>(StopRepository);

    // Reset all mocks
    Object.values(mockRepository).forEach(mock => mock.mockReset());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createRequest: CreateStopRequest = {
      tripId: 'trip-123',
      locationId: 'location-123',
      order: 0,
      plannedDuration: 60,
      stopType: 'PITSTOP',
      notes: 'Test stop',
    };

    it('should create a stop successfully', async () => {
      mockRepository.create.mockResolvedValue(mockStop);

      const result = await service.create(createRequest);

      expect(mockRepository.create).toHaveBeenCalledWith(createRequest, undefined);
      expect(result).toEqual(mockStop);
    });

    it('should throw BadRequestException for negative order', async () => {
      const invalidRequest = { ...createRequest, order: -1 };

      await expect(service.create(invalidRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative planned duration', async () => {
      const invalidRequest = { ...createRequest, plannedDuration: -30 };

      await expect(service.create(invalidRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return stop when found without location', async () => {
      mockRepository.findById.mockResolvedValue(mockStop);

      const result = await service.findById(mockStop.id, false);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(result).toEqual(mockStop);
    });

    it('should return stop when found with location', async () => {
      mockRepository.findByIdWithLocation.mockResolvedValue(mockStopWithLocation);

      const result = await service.findById(mockStop.id, true);

      expect(mockRepository.findByIdWithLocation).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(result).toEqual(mockStopWithLocation);
    });

    it('should throw NotFoundException when stop not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByTripId', () => {
    it('should return stops without locations', async () => {
      const stops = [mockStop];
      mockRepository.findByTripId.mockResolvedValue(stops);

      const result = await service.findByTripId('trip-123', false);

      expect(mockRepository.findByTripId).toHaveBeenCalledWith('trip-123', undefined);
      expect(result).toEqual(stops);
    });

    it('should return stops with locations', async () => {
      const stopsWithLocations = [mockStopWithLocation];
      mockRepository.findByTripIdWithLocations.mockResolvedValue(stopsWithLocations);

      const result = await service.findByTripId('trip-123', true);

      expect(mockRepository.findByTripIdWithLocations).toHaveBeenCalledWith('trip-123', undefined);
      expect(result).toEqual(stopsWithLocations);
    });
  });

  describe('search', () => {
    it('should search stops with criteria', async () => {
      const criteria: StopSearchCriteria = { tripId: 'trip-123', stopType: 'PITSTOP' };
      const searchResults = [mockStop];

      mockRepository.search.mockResolvedValue(searchResults);

      const result = await service.search(criteria);

      expect(mockRepository.search).toHaveBeenCalledWith(criteria, undefined);
      expect(result).toEqual(searchResults);
    });
  });

  describe('update', () => {
    const updateData: UpdateStopRequest = {
      plannedDuration: 90,
      notes: 'Updated notes',
    };

    it('should update stop successfully', async () => {
      const updatedStop = { ...mockStop, ...updateData };

      mockRepository.findById.mockResolvedValue(mockStop);
      mockRepository.update.mockResolvedValue(updatedStop);

      const result = await service.update(mockStop.id, updateData);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(mockRepository.update).toHaveBeenCalledWith(mockStop.id, updateData, undefined);
      expect(result).toEqual(updatedStop);
    });

    it('should throw BadRequestException for negative planned duration', async () => {
      const invalidUpdateData = { plannedDuration: -30 };

      await expect(service.update(mockStop.id, invalidUpdateData)).rejects.toThrow(BadRequestException);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when stop not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateData)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrder', () => {
    it('should update stop order successfully', async () => {
      const newOrder = 5;
      const updatedStop = { ...mockStop, order: newOrder };

      mockRepository.findById.mockResolvedValue(mockStop);
      mockRepository.updateOrder.mockResolvedValue(updatedStop);

      const result = await service.updateOrder(mockStop.id, newOrder);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(mockRepository.updateOrder).toHaveBeenCalledWith(mockStop.id, newOrder, undefined);
      expect(result).toEqual(updatedStop);
    });

    it('should throw BadRequestException for negative order', async () => {
      await expect(service.updateOrder(mockStop.id, -1)).rejects.toThrow(BadRequestException);
      expect(mockRepository.updateOrder).not.toHaveBeenCalled();
    });
  });

  describe('reorderStops', () => {
    const reorderRequest: ReorderStopsRequest = {
      tripId: 'trip-123',
      stopIds: ['stop-1', 'stop-2', 'stop-3'],
    };

    const existingStops = [
      { ...mockStop, id: 'stop-1', order: 0 },
      { ...mockStop, id: 'stop-2', order: 1 },
      { ...mockStop, id: 'stop-3', order: 2 },
    ];

    it('should reorder stops successfully', async () => {
      const reorderedStops = [
        { ...mockStop, id: 'stop-1', order: 0 },
        { ...mockStop, id: 'stop-2', order: 1 },
        { ...mockStop, id: 'stop-3', order: 2 },
      ];

      mockRepository.findByTripId.mockResolvedValue(existingStops);
      mockRepository.bulkUpdateOrders.mockResolvedValue(reorderedStops);

      const result = await service.reorderStops(reorderRequest);

      expect(mockRepository.findByTripId).toHaveBeenCalledWith('trip-123', undefined);
      expect(mockRepository.bulkUpdateOrders).toHaveBeenCalledWith([
        { id: 'stop-1', order: 0 },
        { id: 'stop-2', order: 1 },
        { id: 'stop-3', order: 2 },
      ], undefined);
      expect(result).toEqual(reorderedStops);
    });

    it('should throw BadRequestException for empty stop IDs', async () => {
      const emptyRequest = { ...reorderRequest, stopIds: [] };

      await expect(service.reorderStops(emptyRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.findByTripId).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid stop IDs', async () => {
      const invalidRequest = { ...reorderRequest, stopIds: ['stop-1', 'invalid-stop'] };

      mockRepository.findByTripId.mockResolvedValue(existingStops);

      await expect(service.reorderStops(invalidRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.bulkUpdateOrders).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when not all stops are included', async () => {
      const incompleteRequest = { ...reorderRequest, stopIds: ['stop-1', 'stop-2'] }; // missing stop-3

      mockRepository.findByTripId.mockResolvedValue(existingStops);

      await expect(service.reorderStops(incompleteRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.bulkUpdateOrders).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdate', () => {
    const bulkUpdateRequest: BulkStopUpdateRequest = {
      tripId: 'trip-123',
      updates: [
        { id: 'stop-1', plannedDuration: 90 },
        { id: 'stop-2', notes: 'Updated notes' },
      ],
    };

    const existingStops = [
      { ...mockStop, id: 'stop-1' },
      { ...mockStop, id: 'stop-2' },
    ];

    it('should bulk update stops successfully', async () => {
      const updatedStops = [
        { ...mockStop, id: 'stop-1', plannedDuration: 90 },
        { ...mockStop, id: 'stop-2', notes: 'Updated notes' },
      ];

      mockRepository.findByTripId.mockResolvedValue(existingStops);
      mockRepository.update
        .mockResolvedValueOnce(updatedStops[0])
        .mockResolvedValueOnce(updatedStops[1]);

      const result = await service.bulkUpdate(bulkUpdateRequest);

      expect(mockRepository.findByTripId).toHaveBeenCalledWith('trip-123', undefined);
      expect(mockRepository.update).toHaveBeenCalledTimes(2);
      expect(result).toEqual(updatedStops);
    });

    it('should throw BadRequestException for empty updates', async () => {
      const emptyRequest = { ...bulkUpdateRequest, updates: [] };

      await expect(service.bulkUpdate(emptyRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.findByTripId).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for negative planned duration', async () => {
      const invalidRequest = {
        ...bulkUpdateRequest,
        updates: [{ id: 'stop-1', plannedDuration: -30 }],
      };

      await expect(service.bulkUpdate(invalidRequest)).rejects.toThrow(BadRequestException);
      expect(mockRepository.findByTripId).not.toHaveBeenCalled();
    });
  });

  describe('updateCalculatedTimes', () => {
    it('should update calculated times successfully', async () => {
      const arrivalTime = new Date('2024-07-10T11:00:00Z');
      const departureTime = new Date('2024-07-10T12:00:00Z');
      const updatedStop = { ...mockStop, calculatedArrivalTime: arrivalTime, calculatedDepartureTime: departureTime };

      mockRepository.findById.mockResolvedValue(mockStop);
      mockRepository.updateCalculatedTimes.mockResolvedValue(updatedStop);

      const result = await service.updateCalculatedTimes(mockStop.id, arrivalTime, departureTime);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(mockRepository.updateCalculatedTimes).toHaveBeenCalledWith(
        mockStop.id,
        arrivalTime,
        departureTime,
        undefined
      );
      expect(result).toEqual(updatedStop);
    });
  });

  describe('delete', () => {
    it('should delete stop successfully', async () => {
      mockRepository.findById.mockResolvedValue(mockStop);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(mockStop.id);

      expect(mockRepository.findById).toHaveBeenCalledWith(mockStop.id, undefined);
      expect(mockRepository.delete).toHaveBeenCalledWith(mockStop.id, undefined);
    });

    it('should throw NotFoundException when stop not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteByTripId', () => {
    it('should delete all stops for trip', async () => {
      mockRepository.deleteByTripId.mockResolvedValue(undefined);

      await service.deleteByTripId('trip-123');

      expect(mockRepository.deleteByTripId).toHaveBeenCalledWith('trip-123', undefined);
    });
  });

  describe('getNextOrderForTrip', () => {
    it('should return next order for trip', async () => {
      mockRepository.getNextOrderForTrip.mockResolvedValue(3);

      const result = await service.getNextOrderForTrip('trip-123');

      expect(mockRepository.getNextOrderForTrip).toHaveBeenCalledWith('trip-123', undefined);
      expect(result).toBe(3);
    });
  });

  describe('getStopCount', () => {
    it('should return stop count for trip', async () => {
      mockRepository.getStopCount.mockResolvedValue(5);

      const result = await service.getStopCount('trip-123');

      expect(mockRepository.getStopCount).toHaveBeenCalledWith('trip-123', undefined);
      expect(result).toBe(5);
    });
  });

  describe('validateStopExists', () => {
    it('should return true when stop exists', async () => {
      mockRepository.findById.mockResolvedValue(mockStop);

      const result = await service.validateStopExists(mockStop.id);

      expect(result).toBe(true);
    });

    it('should return false when stop does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.validateStopExists('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('validateStopBelongsToTrip', () => {
    it('should return true when stop belongs to trip', async () => {
      mockRepository.findById.mockResolvedValue(mockStop);

      const result = await service.validateStopBelongsToTrip(mockStop.id, 'trip-123');

      expect(result).toBe(true);
    });

    it('should return false when stop does not belong to trip', async () => {
      mockRepository.findById.mockResolvedValue(mockStop);

      const result = await service.validateStopBelongsToTrip(mockStop.id, 'different-trip');

      expect(result).toBe(false);
    });

    it('should return false when stop does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.validateStopBelongsToTrip('nonexistent-id', 'trip-123');

      expect(result).toBe(false);
    });
  });
});
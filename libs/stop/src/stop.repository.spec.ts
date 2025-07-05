import { Test, TestingModule } from '@nestjs/testing';
import { StopRepository } from './stop.repository';
import { PrismaService } from '@trip-planner/prisma';
import { CreateStopRequest, UpdateStopRequest, StopSearchCriteria, StopOrderUpdate } from './stop.types';

describe('StopRepository', () => {
  let repository: StopRepository;
  let prisma: PrismaService;

  const mockPrismaStop = {
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

  const mockPrismaStopWithLocation = {
    ...mockPrismaStop,
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

  const mockPrismaService = {
    stop: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<StopRepository>(StopRepository);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService.stop).forEach(mock => mock.mockReset());
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a stop', async () => {
      const createRequest: CreateStopRequest = {
        tripId: 'trip-123',
        locationId: 'location-123',
        order: 0,
        plannedArrivalTime: new Date('2024-07-10T10:00:00Z'),
        plannedDuration: 60,
        stopType: 'PITSTOP',
        notes: 'Test stop',
      };

      mockPrismaService.stop.create.mockResolvedValue(mockPrismaStop);

      const result = await repository.create(createRequest);

      expect(mockPrismaService.stop.create).toHaveBeenCalledWith({
        data: {
          tripId: createRequest.tripId,
          locationId: createRequest.locationId,
          order: createRequest.order,
          plannedArrivalTime: createRequest.plannedArrivalTime,
          plannedDuration: createRequest.plannedDuration,
          stopType: createRequest.stopType,
          notes: createRequest.notes,
        },
      });
      expect(result).toEqual(mockPrismaStop);
    });

    it('should handle null optional fields', async () => {
      const createRequest: CreateStopRequest = {
        tripId: 'trip-123',
        locationId: 'location-123',
        order: 0,
      };

      mockPrismaService.stop.create.mockResolvedValue(mockPrismaStop);

      await repository.create(createRequest);

      expect(mockPrismaService.stop.create).toHaveBeenCalledWith({
        data: {
          tripId: createRequest.tripId,
          locationId: createRequest.locationId,
          order: createRequest.order,
          plannedArrivalTime: null,
          plannedDuration: null,
          stopType: null,
          notes: null,
        },
      });
    });
  });

  describe('findById', () => {
    it('should find stop by ID', async () => {
      mockPrismaService.stop.findUnique.mockResolvedValue(mockPrismaStop);

      const result = await repository.findById(mockPrismaStop.id);

      expect(mockPrismaService.stop.findUnique).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
      });
      expect(result).toEqual(mockPrismaStop);
    });

    it('should return null when stop not found', async () => {
      mockPrismaService.stop.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithLocation', () => {
    it('should find stop with location by ID', async () => {
      mockPrismaService.stop.findUnique.mockResolvedValue(mockPrismaStopWithLocation);

      const result = await repository.findByIdWithLocation(mockPrismaStop.id);

      expect(mockPrismaService.stop.findUnique).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              country: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });
      expect(result).toEqual(mockPrismaStopWithLocation);
    });
  });

  describe('findByTripId', () => {
    it('should find stops by trip ID ordered by order', async () => {
      const stops = [mockPrismaStop];
      mockPrismaService.stop.findMany.mockResolvedValue(stops);

      const result = await repository.findByTripId('trip-123');

      expect(mockPrismaService.stop.findMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(stops);
    });
  });

  describe('findByTripIdWithLocations', () => {
    it('should find stops with locations by trip ID', async () => {
      const stopsWithLocations = [mockPrismaStopWithLocation];
      mockPrismaService.stop.findMany.mockResolvedValue(stopsWithLocations);

      const result = await repository.findByTripIdWithLocations('trip-123');

      expect(mockPrismaService.stop.findMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              country: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual(stopsWithLocations);
    });
  });

  describe('search', () => {
    it('should search with multiple criteria', async () => {
      const criteria: StopSearchCriteria = {
        tripId: 'trip-123',
        stopType: 'PITSTOP',
        includeLocation: false,
      };

      mockPrismaService.stop.findMany.mockResolvedValue([mockPrismaStop]);

      const result = await repository.search(criteria);

      expect(mockPrismaService.stop.findMany).toHaveBeenCalledWith({
        where: {
          tripId: 'trip-123',
          stopType: 'PITSTOP',
        },
        include: undefined,
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual([mockPrismaStop]);
    });

    it('should search with location included', async () => {
      const criteria: StopSearchCriteria = {
        tripId: 'trip-123',
        includeLocation: true,
      };

      mockPrismaService.stop.findMany.mockResolvedValue([mockPrismaStopWithLocation]);

      const result = await repository.search(criteria);

      expect(mockPrismaService.stop.findMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              state: true,
              country: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      });
      expect(result).toEqual([mockPrismaStopWithLocation]);
    });
  });

  describe('update', () => {
    it('should update stop with provided fields', async () => {
      const updateData: UpdateStopRequest = {
        plannedDuration: 90,
        notes: 'Updated notes',
      };

      const updatedStop = { ...mockPrismaStop, ...updateData };
      mockPrismaService.stop.update.mockResolvedValue(updatedStop);

      const result = await repository.update(mockPrismaStop.id, updateData);

      expect(mockPrismaService.stop.update).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
        data: {
          plannedDuration: 90,
          notes: 'Updated notes',
        },
      });
      expect(result).toEqual(updatedStop);
    });

    it('should handle undefined fields correctly', async () => {
      const updateData: UpdateStopRequest = {
        plannedDuration: undefined,
        notes: 'Updated notes',
      };

      mockPrismaService.stop.update.mockResolvedValue(mockPrismaStop);

      await repository.update(mockPrismaStop.id, updateData);

      expect(mockPrismaService.stop.update).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
        data: {
          notes: 'Updated notes',
        },
      });
    });
  });

  describe('updateOrder', () => {
    it('should update stop order', async () => {
      const newOrder = 5;
      const updatedStop = { ...mockPrismaStop, order: newOrder };
      mockPrismaService.stop.update.mockResolvedValue(updatedStop);

      const result = await repository.updateOrder(mockPrismaStop.id, newOrder);

      expect(mockPrismaService.stop.update).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
        data: { order: newOrder },
      });
      expect(result).toEqual(updatedStop);
    });
  });

  describe('bulkUpdateOrders', () => {
    it('should update multiple stop orders', async () => {
      const updates: StopOrderUpdate[] = [
        { id: 'stop-1', order: 0 },
        { id: 'stop-2', order: 1 },
      ];

      const updatedStops = [
        { ...mockPrismaStop, id: 'stop-1', order: 0 },
        { ...mockPrismaStop, id: 'stop-2', order: 1 },
      ];

      mockPrismaService.stop.update
        .mockResolvedValueOnce(updatedStops[0])
        .mockResolvedValueOnce(updatedStops[1]);

      const result = await repository.bulkUpdateOrders(updates);

      expect(mockPrismaService.stop.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.stop.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'stop-1' },
        data: { order: 0 },
      });
      expect(mockPrismaService.stop.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'stop-2' },
        data: { order: 1 },
      });
      expect(result).toEqual(updatedStops);
    });
  });

  describe('updateCalculatedTimes', () => {
    it('should update calculated times', async () => {
      const arrivalTime = new Date('2024-07-10T11:00:00Z');
      const departureTime = new Date('2024-07-10T12:00:00Z');
      const updatedStop = {
        ...mockPrismaStop,
        calculatedArrivalTime: arrivalTime,
        calculatedDepartureTime: departureTime,
      };

      mockPrismaService.stop.update.mockResolvedValue(updatedStop);

      const result = await repository.updateCalculatedTimes(
        mockPrismaStop.id,
        arrivalTime,
        departureTime
      );

      expect(mockPrismaService.stop.update).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
        data: {
          calculatedArrivalTime: arrivalTime,
          calculatedDepartureTime: departureTime,
        },
      });
      expect(result).toEqual(updatedStop);
    });
  });

  describe('delete', () => {
    it('should delete stop', async () => {
      mockPrismaService.stop.delete.mockResolvedValue(mockPrismaStop);

      await repository.delete(mockPrismaStop.id);

      expect(mockPrismaService.stop.delete).toHaveBeenCalledWith({
        where: { id: mockPrismaStop.id },
      });
    });
  });

  describe('deleteByTripId', () => {
    it('should delete all stops for a trip', async () => {
      mockPrismaService.stop.deleteMany.mockResolvedValue({ count: 3 });

      await repository.deleteByTripId('trip-123');

      expect(mockPrismaService.stop.deleteMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
      });
    });
  });

  describe('getNextOrderForTrip', () => {
    it('should return next order for trip with existing stops', async () => {
      mockPrismaService.stop.findFirst.mockResolvedValue({ order: 5 });

      const result = await repository.getNextOrderForTrip('trip-123');

      expect(mockPrismaService.stop.findFirst).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      expect(result).toBe(6);
    });

    it('should return 1 for trip with no stops', async () => {
      mockPrismaService.stop.findFirst.mockResolvedValue(null);

      const result = await repository.getNextOrderForTrip('trip-123');

      expect(result).toBe(1);
    });
  });

  describe('getStopCount', () => {
    it('should return stop count for trip', async () => {
      mockPrismaService.stop.count.mockResolvedValue(3);

      const result = await repository.getStopCount('trip-123');

      expect(mockPrismaService.stop.count).toHaveBeenCalledWith({
        where: { tripId: 'trip-123' },
      });
      expect(result).toBe(3);
    });
  });
});
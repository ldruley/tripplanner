import { Test, TestingModule } from '@nestjs/testing';
import { TimelineService } from './timeline.service';
import { Stop, TravelSegment } from '@trip-planner/types';
import { TimelineCalculationRequest } from './timeline.types';

describe('TimelineService', () => {
  let service: TimelineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimelineService],
    }).compile();

    service = module.get<TimelineService>(TimelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateSequentialTimeline', () => {
    it('should return empty result for empty stops', () => {
      const request: TimelineCalculationRequest = {
        stops: [],
        segments: [],
      };

      const result = service.calculateSequentialTimeline(request);

      expect(result.updatedStops).toEqual([]);
      expect(result.totalTripDuration).toBe(0);
      expect(result.hasConflicts).toBe(false);
    });

    it('should calculate timeline for single stop', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: 60,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const request: TimelineCalculationRequest = {
        stops,
        segments: [],
        startTime: new Date('2024-01-01T10:00:00Z'),
      };

      const result = service.calculateSequentialTimeline(request);

      expect(result.updatedStops).toHaveLength(1);
      expect(result.updatedStops[0].calculatedArrivalTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(result.updatedStops[0].calculatedDepartureTime).toEqual(new Date('2024-01-01T11:00:00Z'));
      expect(result.totalTripDuration).toBe(60);
    });

    it('should calculate timeline for multiple stops with travel segments', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: 30,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          tripId: 'trip1',
          locationId: 'loc2',
          order: 1,
          plannedDuration: 45,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const segments: TravelSegment[] = [
        {
          id: 'seg1',
          tripId: 'trip1',
          originStopId: '1',
          destinationStopId: '2',
          travelMode: 'DRIVING',
          duration: 90,
          apiCalculatedDuration: 90,
          distance: null,
          apiCalculatedDistance: null,
          polyline: null,
          routeOptions: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const request: TimelineCalculationRequest = {
        stops,
        segments,
        startTime: new Date('2024-01-01T10:00:00Z'),
      };

      const result = service.calculateSequentialTimeline(request);

      expect(result.updatedStops).toHaveLength(2);
      
      // First stop
      expect(result.updatedStops[0].calculatedArrivalTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(result.updatedStops[0].calculatedDepartureTime).toEqual(new Date('2024-01-01T10:30:00Z'));
      
      // Second stop (30min + 90min travel = 120min = 2 hours from start)
      expect(result.updatedStops[1].calculatedArrivalTime).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(result.updatedStops[1].calculatedDepartureTime).toEqual(new Date('2024-01-01T12:45:00Z'));
      
      // Total: 30 + 90 + 45 = 165 minutes
      expect(result.totalTripDuration).toBe(165);
    });

    it('should use default durations when plannedDuration is null', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: null,
          stopType: 'OVERNIGHT',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const request: TimelineCalculationRequest = {
        stops,
        segments: [],
        startTime: new Date('2024-01-01T10:00:00Z'),
      };

      const result = service.calculateSequentialTimeline(request);

      expect(result.updatedStops[0].calculatedDepartureTime).toEqual(new Date('2024-01-01T22:00:00Z')); // 10:00 + 12h = 22:00
      expect(result.totalTripDuration).toBe(720); // 12 hours = 720 minutes
    });
  });

  describe('calculateTripDuration', () => {
    it('should calculate total duration including stops and travel', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: 60,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          tripId: 'trip1',
          locationId: 'loc2',
          order: 1,
          plannedDuration: 30,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const segments: TravelSegment[] = [
        {
          id: 'seg1',
          tripId: 'trip1',
          originStopId: '1',
          destinationStopId: '2',
          travelMode: 'DRIVING',
          duration: 45,
          apiCalculatedDuration: 45,
          distance: null,
          apiCalculatedDistance: null,
          polyline: null,
          routeOptions: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const duration = service.calculateTripDuration(stops, segments);

      expect(duration).toBe(135); // 60 + 30 + 45 = 135 minutes
    });
  });

  describe('getDefaultStopDuration', () => {
    it('should return correct default durations', () => {
      expect(service.getDefaultStopDuration('PITSTOP')).toBe(30);
      expect(service.getDefaultStopDuration('OVERNIGHT')).toBe(720);
      expect(service.getDefaultStopDuration(null)).toBe(60);
      expect(service.getDefaultStopDuration('UNKNOWN')).toBe(60);
    });
  });

  describe('validateBasicSchedule', () => {
    it('should return true for valid schedule', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: 60,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      expect(service.validateBasicSchedule(stops)).toBe(true);
    });

    it('should return false for negative duration', () => {
      const stops: Stop[] = [
        {
          id: '1',
          tripId: 'trip1',
          locationId: 'loc1',
          order: 0,
          plannedDuration: -30,
          stopType: 'PITSTOP',
          plannedArrivalTime: null,
          calculatedArrivalTime: null,
          calculatedDepartureTime: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      expect(service.validateBasicSchedule(stops)).toBe(false);
    });
  });
});
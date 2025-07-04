import { Stop, TravelSegment } from '@trip-planner/types';

export interface TimelineCalculationRequest {
  stops: Stop[]; // Ordered by sequence
  segments: TravelSegment[]; // Between consecutive stops
  startTime?: Date; // Optional trip start time
}

export interface TimelineCalculationResult {
  updatedStops: Stop[];
  totalTripDuration: number; // in minutes
  tripStartTime?: Date;
  tripEndTime?: Date;
  hasConflicts: boolean;
}

export const DEFAULT_DURATIONS = {
  PITSTOP: 30,    // 30 minutes
  OVERNIGHT: 720, // 12 hours
  null: 60        // 1 hour default
} as const;

export interface StopTypeDefaults {
  [key: string]: number;
}
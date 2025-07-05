import { Stop, TravelSegment } from '@trip-planner/types';

export const DEFAULT_DURATIONS = {
  PITSTOP: 30, // 30 minutes
  OVERNIGHT: 720, // 12 hours
  null: 60, // 1 hour default
} as const;

export interface StopTypeDefaults {
  [key: string]: number;
}

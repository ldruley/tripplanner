import { Stop, TravelSegment } from '@trip-planner/types';

export const DEFAULT_DURATIONS = {
  PITSTOP: 1800, // 30 minutes in seconds
  OVERNIGHT: 43200, // 12 hours in seconds
  null: 3600, // 1 hour default in seconds
} as const;

export interface StopTypeDefaults {
  [key: string]: number;
}

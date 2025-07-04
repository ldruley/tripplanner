import { DEFAULT_DURATIONS } from '../timeline.types';

/**
 * Get default duration for a stop type
 * These are suggestions only - never override user input
 */
export function getDefaultStopDuration(stopType: string | null): number {
  switch (stopType) {
    case 'PITSTOP':
      return DEFAULT_DURATIONS.PITSTOP;
    case 'OVERNIGHT':
      return DEFAULT_DURATIONS.OVERNIGHT;
    default:
      return DEFAULT_DURATIONS.null;
  }
}

/**
 * Get human-readable duration description
 * TODO: switch to standardized functions
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get suggested duration ranges for different stop types
 */
export function getSuggestedDurationRange(stopType: string | null): {
  min: number;
  max: number;
  suggested: number;
} {
  switch (stopType) {
    case 'PITSTOP':
      return { min: 15, max: 120, suggested: DEFAULT_DURATIONS.PITSTOP };
    case 'OVERNIGHT':
      return { min: 480, max: 960, suggested: DEFAULT_DURATIONS.OVERNIGHT };
    default:
      return { min: 30, max: 240, suggested: DEFAULT_DURATIONS.null };
  }
}

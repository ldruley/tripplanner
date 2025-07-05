import { Location } from '@trip-planner/types';

export interface LocationDeduplicationOptions {
  enableExactCoordinateMatching?: boolean; // default true
  enableApiSourceMatching?: boolean; // default true
}

export interface LocationDuplicateCheck {
  isDuplicate: boolean;
  existingLocation?: Location;
  matchReason?: 'exact_coordinates' | 'api_source';
}

export const DEFAULT_DEDUPLICATION_OPTIONS: LocationDeduplicationOptions = {
  enableExactCoordinateMatching: true,
  enableApiSourceMatching: true,
};

import { Location } from '@trip-planner/types';

export interface CreateLocationRequest {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  apiSource?: string;
  apiSourceId?: string; // Provider-specific ID (e.g., Google Places ID, HERE ID)
  category?: string;
  public?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  apiSource?: string;
  apiSourceId?: string;
  category?: string;
  public?: boolean;
}

export interface LocationDeduplicationOptions {
  enableExactCoordinateMatching?: boolean; // default true
  enableApiSourceMatching?: boolean; // default true
}

export interface LocationSearchCriteria {
  name?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    radius: number; // meters
  };
  city?: string;
  state?: string;
  country?: string;
  public?: boolean;
  apiSource?: string;
  category?: string;
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
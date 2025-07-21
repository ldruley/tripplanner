import { Trip, TripBankedLocation } from '@trip-planner/types';

/**
 * Base interface for all queries
 */
export interface Query<TResult> {
  readonly type: string;
}

/**
 * Query to get all trips for the current user
 */
export interface GetAllTripsQuery extends Query<Trip[]> {
  readonly type: '[Trip] Get All Trips';
}

/**
 * Query to get a specific trip by ID
 */
export interface GetTripByIdQuery extends Query<Trip | null> {
  readonly type: '[Trip] Get Trip By Id';
  readonly payload: {
    tripId: string;
    includeStops?: boolean;
    includeBankedLocations?: boolean;
    includeTravelSegments?: boolean;
  };
}

/**
 * Query to get a trip with all relations (stops, banked locations, travel segments)
 */
export interface GetTripWithRelationsQuery extends Query<Trip | null> {
  readonly type: '[Trip] Get Trip With Relations';
  readonly payload: {
    tripId: string;
  };
}

/**
 * Query to get banked locations for a specific trip
 */
export interface GetBankedLocationsQuery extends Query<TripBankedLocation[]> {
  readonly type: '[Trip] Get Banked Locations';
  readonly payload: {
    tripId: string;
  };
}

/**
 * Query to get trip count for the current user
 */
export interface GetTripCountQuery extends Query<{ count: number }> {
  readonly type: '[Trip] Get Trip Count';
}

/**
 * Union type for all trip-related queries
 */
export type TripQuery =
  | GetAllTripsQuery
  | GetTripByIdQuery
  | GetTripCountQuery
  | GetTripWithRelationsQuery
  | GetBankedLocationsQuery;

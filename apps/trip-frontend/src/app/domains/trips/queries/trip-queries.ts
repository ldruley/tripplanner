import { Trip } from '@trip-planner/types';

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
  | GetTripCountQuery;
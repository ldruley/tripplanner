import { Location, SearchMode, UserFavoriteLocation } from '@trip-planner/types';

/**
 * Base interface for all location queries
 */
export interface Query<TResult> {
  readonly type: string;
}

/**
 * Query to search for locations using the specified search mode
 */
export interface SearchLocationsQuery extends Query<Location[]> {
  readonly type: '[Location] Search Locations';
  readonly payload: { 
    query: string; 
    mode: SearchMode; 
  };
}

/**
 * Query to search for locations by address using geocoding
 */
export interface SearchByAddressQuery extends Query<Location[]> {
  readonly type: '[Location] Search By Address';
  readonly payload: { 
    query: string; 
  };
}

/**
 * Query to search for locations by place name using POI search
 */
export interface SearchByPlaceQuery extends Query<Location[]> {
  readonly type: '[Location] Search By Place';
  readonly payload: { 
    query: string; 
  };
}

/**
 * Query to get user's favorite locations
 */
export interface GetUserFavoritesQuery extends Query<UserFavoriteLocation[]> {
  readonly type: '[Location] Get User Favorites';
}

/**
 * Query to get a specific favorite location by ID
 */
export interface GetFavoriteByIdQuery extends Query<UserFavoriteLocation | null> {
  readonly type: '[Location] Get Favorite By Id';
  readonly payload: { 
    favoriteId: string; 
  };
}
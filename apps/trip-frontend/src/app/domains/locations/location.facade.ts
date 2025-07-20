import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { 
  Location, 
  SearchMode, 
  UserFavoriteLocation, 
  CreateUserFavoriteLocation, 
  UpdateUserFavoriteLocation 
} from '@trip-planner/types';

// Service imports
import { LocationQueryService } from './services/location-query.service';
import { LocationCommandService } from './services/location-command.service';

// Query types
import {
  SearchLocationsQuery,
  SearchByAddressQuery,
  SearchByPlaceQuery,
  GetUserFavoritesQuery,
  GetFavoriteByIdQuery,
} from './queries/location-queries';

// Command types
import {
  CreateFavoriteLocationCommand,
  UpdateFavoriteLocationCommand,
  DeleteFavoriteLocationCommand,
} from './commands/location-commands';

/**
 * LocationFacade
 * 
 * Unified domain facade that provides a clean, simplified API for feature modules
 * to interact with the location domain, abstracting away the underlying CQRS 
 * complexity for location search and favorite management.
 * 
 * This service orchestrates calls to LocationQueryService and LocationCommandService
 * to provide high-level, use-case-driven methods for location operations.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationFacade {
  private readonly queryService = inject(LocationQueryService);
  private readonly commandService = inject(LocationCommandService);

  // =============================================================================
  // SEARCH OPERATIONS (Queries)
  // =============================================================================

  /**
   * Search for locations using the specified search mode
   * Delegates to either address or place search based on mode
   */
  searchLocations(query: string, mode: SearchMode): Observable<Location[]> {
    const searchQuery: SearchLocationsQuery = {
      type: '[Location] Search Locations',
      payload: { query, mode }
    };
    return this.queryService.execute(searchQuery);
  }

  /**
   * Search for locations by address using forward geocoding
   */
  searchByAddress(query: string): Observable<Location[]> {
    const searchQuery: SearchByAddressQuery = {
      type: '[Location] Search By Address',
      payload: { query }
    };
    return this.queryService.execute(searchQuery);
  }

  /**
   * Search for locations by place name using POI search
   */
  searchByPlace(query: string): Observable<Location[]> {
    const searchQuery: SearchByPlaceQuery = {
      type: '[Location] Search By Place',
      payload: { query }
    };
    return this.queryService.execute(searchQuery);
  }

  // =============================================================================
  // FAVORITE OPERATIONS (Queries & Commands)
  // =============================================================================

  /**
   * Get all user favorite locations
   */
  getUserFavorites(): Observable<UserFavoriteLocation[]> {
    const favoritesQuery: GetUserFavoritesQuery = {
      type: '[Location] Get User Favorites'
    };
    return this.queryService.execute(favoritesQuery);
  }

  /**
   * Get a specific favorite location by ID
   */
  getFavoriteById(favoriteId: string): Observable<UserFavoriteLocation | null> {
    const favoriteQuery: GetFavoriteByIdQuery = {
      type: '[Location] Get Favorite By Id',
      payload: { favoriteId }
    };
    return this.queryService.execute(favoriteQuery);
  }

  /**
   * Create a new user favorite location
   */
  createFavorite(favoriteData: CreateUserFavoriteLocation): Observable<UserFavoriteLocation> {
    const createCommand: CreateFavoriteLocationCommand = {
      type: '[Location] Create Favorite',
      payload: favoriteData
    };
    return this.commandService.execute(createCommand);
  }

  /**
   * Update an existing user favorite location
   */
  updateFavorite(favoriteId: string, updates: UpdateUserFavoriteLocation): Observable<UserFavoriteLocation> {
    const updateCommand: UpdateFavoriteLocationCommand = {
      type: '[Location] Update Favorite',
      payload: { favoriteId, updates }
    };
    return this.commandService.execute(updateCommand);
  }

  /**
   * Delete a user favorite location
   */
  deleteFavorite(favoriteId: string): Observable<void> {
    const deleteCommand: DeleteFavoriteLocationCommand = {
      type: '[Location] Delete Favorite',
      payload: { favoriteId }
    };
    return this.commandService.execute(deleteCommand);
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  /**
   * Clear the favorites cache
   * Useful when favorites are modified outside of this facade
   */
  clearFavoritesCache(): void {
    this.queryService.clearFavoritesCache();
  }
}
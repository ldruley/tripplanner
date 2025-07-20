import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, tap, map, shareReplay } from 'rxjs/operators';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Location, SearchMode, UserFavoriteLocation } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import {
  Query,
  SearchLocationsQuery,
  SearchByAddressQuery,
  SearchByPlaceQuery,
  GetUserFavoritesQuery,
  GetFavoriteByIdQuery,
} from '../queries/location-queries';

/**
 * LocationQueryService
 * 
 * Handles all read operations for the location domain, including
 * location search (geocoding and POI) and user favorite locations.
 */
@Injectable({ providedIn: 'root' })
export class LocationQueryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl;

  // Simple in-memory cache for favorites
  private favoritesCache$: Observable<UserFavoriteLocation[]> | null = null;

  /**
   * Execute a location query
   */
  execute<TResult>(query: Query<TResult>): Observable<TResult> {
    switch (query.type) {
      case '[Location] Search Locations':
        return this.handleSearchLocations(query as SearchLocationsQuery) as Observable<TResult>;

      case '[Location] Search By Address':
        return this.handleSearchByAddress(query as SearchByAddressQuery) as Observable<TResult>;

      case '[Location] Search By Place':
        return this.handleSearchByPlace(query as SearchByPlaceQuery) as Observable<TResult>;

      case '[Location] Get User Favorites':
        return this.handleGetUserFavorites(query as GetUserFavoritesQuery) as Observable<TResult>;

      case '[Location] Get Favorite By Id':
        return this.handleGetFavoriteById(query as GetFavoriteByIdQuery) as Observable<TResult>;

      default:
        return throwError(() => new Error(`Unknown query type: ${query.type}`));
    }
  }

  /**
   * Handle location search with specified mode
   */
  private handleSearchLocations(query: SearchLocationsQuery): Observable<Location[]> {
    const { query: searchQuery, mode } = query.payload;

    if (mode === 'address') {
      return this.searchByAddress(searchQuery);
    } else {
      return this.searchByPlace(searchQuery);
    }
  }

  /**
   * Handle address-based search (geocoding)
   */
  private handleSearchByAddress(query: SearchByAddressQuery): Observable<Location[]> {
    return this.searchByAddress(query.payload.query);
  }

  /**
   * Handle place-based search (POI search)
   */
  private handleSearchByPlace(query: SearchByPlaceQuery): Observable<Location[]> {
    return this.searchByPlace(query.payload.query);
  }

  /**
   * Handle getting user favorites
   */
  private handleGetUserFavorites(query: GetUserFavoritesQuery): Observable<UserFavoriteLocation[]> {
    // Use cache if available, otherwise fetch fresh data
    if (!this.favoritesCache$) {
      this.favoritesCache$ = this.http
        .get<{
          success: boolean;
          data: UserFavoriteLocation[];
          message: string;
        }>(`${this.apiUrl}/user-favorites`)
        .pipe(
          map(response => {
            if (!response.success) {
              throw new Error(response.message || 'Failed to fetch favorites');
            }
            return response.data;
          }),
          shareReplay(1),
          catchError(error => {
            console.error('LocationQueryService: Failed to fetch user favorites:', error);
            this.clearFavoritesCache();
            return throwError(() => error);
          })
        );
    }

    return this.favoritesCache$;
  }

  /**
   * Handle getting a specific favorite by ID
   */
  private handleGetFavoriteById(query: GetFavoriteByIdQuery): Observable<UserFavoriteLocation | null> {
    const { favoriteId } = query.payload;

    return this.http
      .get<{
        success: boolean;
        data: UserFavoriteLocation;
        message: string;
      }>(`${this.apiUrl}/user-favorites/${favoriteId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to fetch favorite');
          }
          return response.data;
        }),
        catchError(error => {
          if (error.status === 404) {
            return of(null);
          }
          console.error('LocationQueryService: Failed to fetch favorite by ID:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Forward geocoding search for addresses
   */
  private searchByAddress(query: string): Observable<Location[]> {
    const params = new HttpParams().set('search', query);
    const endpoint = `${this.apiUrl}/geocoding/forward`;

    return this.http.get<Location[]>(endpoint, { params }).pipe(
      catchError(error => {
        console.error('LocationQueryService: Address search failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * POI search for places
   */
  private searchByPlace(query: string): Observable<Location[]> {
    const params = new HttpParams().set('search', query);
    const endpoint = `${this.apiUrl}/poi/poi-search`;

    return this.http.get<Location[]>(endpoint, { params }).pipe(
      catchError(error => {
        console.error('LocationQueryService: Place search failed:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear the favorites cache (called when favorites are modified)
   */
  clearFavoritesCache(): void {
    this.favoritesCache$ = null;
  }
}
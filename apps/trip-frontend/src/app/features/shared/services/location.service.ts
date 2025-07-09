import { Injectable, signal } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { environment } from 'apps/trip-frontend/src/environments/environment';
import {
  Location,
  UserFavoriteLocationWithLocation,
  CreateUserFavoriteLocation,
  UpdateUserFavoriteLocation,
} from '@trip-planner/types';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly apiUrl = environment.backendApiUrl;

  // Reactive state for favorites
  private favoritesSubject = new BehaviorSubject<UserFavoriteLocationWithLocation[]>([]);
  public favorites$ = this.favoritesSubject.asObservable();

  // Signal for UI reactivity
  public favoritesSignal = signal<UserFavoriteLocationWithLocation[]>([]);
  public isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  /**
   * Get all user favorite locations
   */
  getUserFavorites(): Observable<UserFavoriteLocationWithLocation[]> {
    this.isLoading.set(true);

    return this.http
      .get<{
        success: boolean;
        data: UserFavoriteLocationWithLocation[];
        message: string;
      }>(`${this.apiUrl}/user-favorites`)
      .pipe(
        map(response => response.data),
        tap(favorites => {
          this.favoritesSubject.next(favorites);
          this.favoritesSignal.set(favorites);
          this.isLoading.set(false);
        }),
        catchError(error => {
          console.error('Error fetching user favorites:', error);
          this.isLoading.set(false);
          return of([]);
        }),
      );
  }

  /**
   * Add a location to user favorites
   */
  addToFavorites(
    locationId: string,
    metadata: Partial<CreateUserFavoriteLocation> = {},
  ): Observable<UserFavoriteLocationWithLocation> {
    const data: CreateUserFavoriteLocation = {
      locationId,
      alias: metadata.alias || null,
      notes: metadata.notes || null,
      tags: metadata.tags || [],
    };

    return this.http
      .post<{
        success: boolean;
        data: UserFavoriteLocationWithLocation;
        message: string;
      }>(`${this.apiUrl}/user-favorites`, data)
      .pipe(
        map(response => response.data),
        tap(newFavorite => {
          // Update local state
          const currentFavorites = this.favoritesSubject.value;
          const updatedFavorites = [newFavorite, ...currentFavorites];
          this.favoritesSubject.next(updatedFavorites);
          this.favoritesSignal.set(updatedFavorites);
        }),
        catchError(error => {
          console.error('Error adding location to favorites:', error);
          throw error;
        }),
      );
  }

  /**
   * Remove a location from user favorites
   */
  removeFromFavorites(locationId: string): Observable<void> {
    return this.http
      .delete<{
        success: boolean;
        message: string;
      }>(`${this.apiUrl}/user-favorites/${locationId}`)
      .pipe(
        map(response => void 0),
        tap(() => {
          // Update local state
          const currentFavorites = this.favoritesSubject.value;
          const updatedFavorites = currentFavorites.filter(
            favorite => favorite.locationId !== locationId,
          );
          this.favoritesSubject.next(updatedFavorites);
          this.favoritesSignal.set(updatedFavorites);
        }),
        catchError(error => {
          console.error('Error removing location from favorites:', error);
          throw error;
        }),
      );
  }

  /**
   * Update favorite location metadata
   */
  updateFavoriteMetadata(
    locationId: string,
    metadata: UpdateUserFavoriteLocation,
  ): Observable<UserFavoriteLocationWithLocation> {
    return this.http
      .put<{
        success: boolean;
        data: UserFavoriteLocationWithLocation;
        message: string;
      }>(`${this.apiUrl}/user-favorites/${locationId}`, metadata)
      .pipe(
        map(response => response.data),
        tap(updatedFavorite => {
          // Update local state
          const currentFavorites = this.favoritesSubject.value;
          const updatedFavorites = currentFavorites.map(favorite =>
            favorite.locationId === locationId ? updatedFavorite : favorite,
          );
          this.favoritesSubject.next(updatedFavorites);
          this.favoritesSignal.set(updatedFavorites);
        }),
        catchError(error => {
          console.error('Error updating favorite metadata:', error);
          throw error;
        }),
      );
  }

  /**
   * Check if a location is in user favorites
   */
  isFavorite(locationId: string): Observable<boolean> {
    return this.http
      .get<{
        success: boolean;
        data: { isFavorite: boolean };
        message: string;
      }>(`${this.apiUrl}/user-favorites/${locationId}/is-favorite`)
      .pipe(
        map(response => response.data.isFavorite),
        catchError(error => {
          console.error('Error checking favorite status:', error);
          return of(false);
        }),
      );
  }

  /**
   * Check if a location is in local favorites (signal-based)
   */
  isLocalFavorite(locationId: string): boolean {
    return this.favoritesSignal().some(favorite => favorite.locationId === locationId);
  }

  /**
   * Get favorite metadata for a location
   */
  getFavoriteMetadata(locationId: string): UserFavoriteLocationWithLocation | null {
    return this.favoritesSignal().find(favorite => favorite.locationId === locationId) || null;
  }

  /**
   * Refresh favorites from server
   */
  refreshFavorites(): Observable<UserFavoriteLocationWithLocation[]> {
    return this.getUserFavorites();
  }

  /**
   * Create a new location and optionally add it to favorites
   */
  createLocationAndAddToFavorites(
    location: Omit<Location, 'createdAt' | 'updatedAt'>,
    metadata: Partial<CreateUserFavoriteLocation> = {},
  ): Observable<UserFavoriteLocationWithLocation> {
    // First create the location - the location endpoint returns a raw Location object, not wrapped
    return this.http
      .post<Location>(`${this.apiUrl}/location`, location)
      .pipe(
        // Then add it to favorites
        switchMap(createdLocation => this.addToFavorites(createdLocation.id, metadata)),
        catchError(error => {
          console.error('Error creating location and adding to favorites:', error);
          throw error;
        }),
      );
  }
}

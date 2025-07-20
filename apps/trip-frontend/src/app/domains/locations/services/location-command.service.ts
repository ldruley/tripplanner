import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { 
  UserFavoriteLocation, 
  CreateUserFavoriteLocation, 
  UpdateUserFavoriteLocation 
} from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import {
  Command,
  CreateFavoriteLocationCommand,
  UpdateFavoriteLocationCommand,
  DeleteFavoriteLocationCommand,
} from '../commands/location-commands';
import { LocationQueryService } from './location-query.service';

/**
 * LocationCommandService
 * 
 * Handles all write operations for the location domain,
 * specifically user favorite location management.
 */
@Injectable({ providedIn: 'root' })
export class LocationCommandService {
  private readonly http = inject(HttpClient);
  private readonly locationQueryService = inject(LocationQueryService);
  private readonly apiUrl = environment.backendApiUrl;

  /**
   * Execute a location command
   */
  execute<TResult>(command: Command<TResult>): Observable<TResult> {
    switch (command.type) {
      case '[Location] Create Favorite':
        return this.handleCreateFavorite(command as CreateFavoriteLocationCommand) as Observable<TResult>;

      case '[Location] Update Favorite':
        return this.handleUpdateFavorite(command as UpdateFavoriteLocationCommand) as Observable<TResult>;

      case '[Location] Delete Favorite':
        return this.handleDeleteFavorite(command as DeleteFavoriteLocationCommand) as Observable<TResult>;

      default:
        return throwError(() => new Error(`Unknown command type: ${command.type}`));
    }
  }

  /**
   * Handle creating a new favorite location
   */
  private handleCreateFavorite(command: CreateFavoriteLocationCommand): Observable<UserFavoriteLocation> {
    return this.http
      .post<{
        success: boolean;
        data: UserFavoriteLocation;
        message: string;
      }>(`${this.apiUrl}/user-favorites`, command.payload)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to create favorite');
          }
          return response.data;
        }),
        tap(() => {
          // Clear cache to force refresh on next query
          this.locationQueryService.clearFavoritesCache();
        }),
        catchError(error => {
          console.error('LocationCommandService: Failed to create favorite:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Handle updating an existing favorite location
   */
  private handleUpdateFavorite(command: UpdateFavoriteLocationCommand): Observable<UserFavoriteLocation> {
    const { favoriteId, updates } = command.payload;

    return this.http
      .put<{
        success: boolean;
        data: UserFavoriteLocation;
        message: string;
      }>(`${this.apiUrl}/user-favorites/${favoriteId}`, updates)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to update favorite');
          }
          return response.data;
        }),
        tap(() => {
          // Clear cache to force refresh on next query
          this.locationQueryService.clearFavoritesCache();
        }),
        catchError(error => {
          console.error('LocationCommandService: Failed to update favorite:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Handle deleting a favorite location
   */
  private handleDeleteFavorite(command: DeleteFavoriteLocationCommand): Observable<void> {
    const { favoriteId } = command.payload;

    return this.http
      .delete<{
        success: boolean;
        message: string;
      }>(`${this.apiUrl}/user-favorites/${favoriteId}`)
      .pipe(
        map(response => {
          if (!response.success) {
            throw new Error(response.message || 'Failed to delete favorite');
          }
          return undefined;
        }),
        tap(() => {
          // Clear cache to force refresh on next query
          this.locationQueryService.clearFavoritesCache();
        }),
        catchError(error => {
          console.error('LocationCommandService: Failed to delete favorite:', error);
          return throwError(() => error);
        })
      );
  }
}
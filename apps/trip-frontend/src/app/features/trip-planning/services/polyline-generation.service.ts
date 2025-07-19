import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Trip } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import { TravelMode } from '@prisma/client';

export interface PolylineStatus {
  needsPolylines: boolean;
  hasCompleteRouting: boolean;
  segmentCount: number;
  segmentsWithPolylines: number;
}

export interface PolylineGenerationOptions {
  travelMode?: TravelMode;
  forceRecalculate?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PolylineGenerationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl + '/itinerary';

  // Public signals for UI state
  public readonly isGenerating = signal(false);
  public readonly error = signal<string | null>(null);

  /**
   * Generate polylines for a trip
   * @param tripId - ID of the trip to generate polylines for
   * @param options - Generation options
   * @returns Observable of updated trip with polylines
   */
  generatePolylines(tripId: string, options: PolylineGenerationOptions = {}): Observable<Trip> {
    this.isGenerating.set(true);
    this.error.set(null);

    console.log('PolylineGenerationService: Generating polylines for trip:', tripId, options);

    return this.http.post<Trip>(`${this.apiUrl}/trips/${tripId}/generate-polylines`, options).pipe(
      tap(updatedTrip => {
        this.isGenerating.set(false);
        console.log('PolylineGenerationService: Successfully generated polylines for trip:', tripId);
      }),
      catchError(error => {
        this.isGenerating.set(false);
        const errorMessage = error.error?.message || error.message || 'Failed to generate polylines';
        this.error.set(errorMessage);
        console.error('PolylineGenerationService: Error generating polylines:', error);
        throw error;
      })
    );
  }

  /**
   * Check polyline status for a trip
   * @param tripId - ID of the trip to check
   * @returns Observable of polyline status
   */
  getPolylineStatus(tripId: string): Observable<PolylineStatus> {
    console.log('PolylineGenerationService: Getting polyline status for trip:', tripId);

    return this.http.get<PolylineStatus>(`${this.apiUrl}/trips/${tripId}/polyline-status`).pipe(
      tap(status => {
        console.log('PolylineGenerationService: Polyline status for trip:', tripId, status);
      }),
      catchError(error => {
        const errorMessage = error.error?.message || error.message || 'Failed to get polyline status';
        this.error.set(errorMessage);
        console.error('PolylineGenerationService: Error getting polyline status:', error);
        throw error;
      })
    );
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }
}
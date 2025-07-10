import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trip, TripSchema } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TripsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl;

  /**
   * Get all trips for the current user
   */
  getTrips(): Observable<Trip[]> {
    return this.http.get<Trip[]>(`${this.apiUrl}/trips`).pipe(
      map(response => response.map(trip => TripSchema.parse(trip)))
    );
  }

  /**
   * Get a specific trip by ID
   */
  getTrip(tripId: string, includeStops = false, includeBankedLocations = false): Observable<Trip> {
    const params = new URLSearchParams();
    if (includeStops) params.append('includeStops', 'true');
    if (includeBankedLocations) params.append('includeBankedLocations', 'true');
    
    const queryString = params.toString();
    const url = queryString ? `${this.apiUrl}/trips/${tripId}?${queryString}` : `${this.apiUrl}/trips/${tripId}`;
    
    return this.http.get<Trip>(url).pipe(
      map(response => TripSchema.parse(response))
    );
  }

  /**
   * Delete a trip by ID
   */
  deleteTrip(tripId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/trips/${tripId}`);
  }

  /**
   * Get trip count for the current user
   */
  getTripCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/trips/user/count`);
  }
}
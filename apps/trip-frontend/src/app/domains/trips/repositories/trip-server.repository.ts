import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Trip, TripSchema, CreateTripRequest } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import { ITripServerRepository } from './interfaces/trip-server-repository.interface';

@Injectable({
  providedIn: 'root',
})
export class TripServerRepository implements ITripServerRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl;


  /**
   * Delete a trip by ID
   */
  deleteTrip(tripId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/trips/${tripId}`);
  }

  /**
   * Create a new trip
   */
  createTrip(name: string, description?: string): Observable<Trip> {
    const createRequest: CreateTripRequest = {
      name,
      description: description || null,
      startDate: null,
      endDate: null,
      matrix: null,
    };

    return this.http
      .post<Trip>(`${this.apiUrl}/trips`, createRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Update an existing trip
   */
  updateTrip(tripId: string, updates: Partial<Trip>): Observable<Trip> {
    // Only send updatable fields to the backend
    const updateRequest = {
      name: updates.name,
      description: updates.description,
      startDate: updates.startDate,
      endDate: updates.endDate,
      matrix: updates.matrix,
    };

    return this.http
      .put<Trip>(`${this.apiUrl}/trips/${tripId}`, updateRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

}

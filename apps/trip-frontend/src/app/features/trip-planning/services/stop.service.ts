import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Stop, UpdateStopRequest } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StopService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl;

  /**
   * Update a stop with new details
   */
  updateStop(stopId: string, updateData: UpdateStopRequest): Observable<Stop> {
    return this.http.patch<Stop>(`${this.apiUrl}/stops/${stopId}`, updateData);
  }

  /**
   * Get a specific stop by ID
   */
  getStop(stopId: string): Observable<Stop> {
    return this.http.get<Stop>(`${this.apiUrl}/stops/${stopId}`);
  }
}
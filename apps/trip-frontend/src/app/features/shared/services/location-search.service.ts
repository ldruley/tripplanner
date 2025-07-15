import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Location, SearchMode } from '@trip-planner/types';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'apps/trip-frontend/src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LocationSearchService {
  private readonly apiUrl = environment.backendApiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Searches for locations by calling the appropriate backend endpoint based on the search mode.
   * @param query The search string entered by the user.
   * @param mode The search mode, either 'address' or 'place'.
   * @returns An Observable of an array of Location objects.
   */
  searchLocations(query: string, mode: SearchMode): Observable<Location[]> {
    if (mode === 'address') {
      return this.searchByAddress(query);
    } else {
      return this.searchByPlace(query);
    }
  }

  /**
   * Calls the forward geocoding endpoint to search for addresses.
   * @param query The address string.
   */
  private searchByAddress(query: string): Observable<Location[]> {
    const params = new HttpParams().set('search', query);
    const endpoint = `${this.apiUrl}/geocoding/forward`;

    return this.http.get<Location[]>(endpoint, { params });
  }

  /**
   * Calls the POI search endpoint to search for places.
   * @param query The place name string.
   */
  private searchByPlace(query: string): Observable<Location[]> {
    const params = new HttpParams().set('search', query);
    const endpoint = `${this.apiUrl}/poi/poi-search`;

    return this.http.get<Location[]>(endpoint, { params });
  }

}

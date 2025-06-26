import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Location } from '../models/location.model';
import { Stop } from '../models/stop.model';
import { TravelSegmentData } from '../components/itinerary-builder/itinerary-builder.component';
import { environment } from '../../../../environments/environment';
import { CoordinateMatrix } from '../../../../../../../libs/shared/types/src/schemas/matrix.schema';

@Injectable({
  providedIn: 'root'
})
export class MatrixCalculationService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl + '/matrix-routing';

  private matrix = signal<CoordinateMatrix | null>(null);

  // Public signals
  public readonly isLoading = signal(false);
  public readonly error = signal<string | null>(null);

  // Stores raw CoordinateMatrix results
  private cache = new Map<string, CoordinateMatrix>();
  // Stores the key of the last successfully calculated matrix
  private lastCalculatedKey: string | null = null;

  /**
   * Public-facing computed signal that transforms the raw matrix into the format
   * the ItineraryBuilderComponent expects. Components should consume this.
   */
  public readonly formattedMatrix = computed(() => {
    const rawMatrix = this.matrix();
    if (!rawMatrix) {
      return null;
    }
    return this.transformMatrixToSegments(rawMatrix);
  });

  /**
   * Main method to trigger a matrix calculation.
   * It's smart enough to use the cache or avoid re-fetching for the same data set.
   * @param itineraryStops The current list of stops in the itinerary.
   * @param draggedLocation The new location being dragged from the bank.
   */
  public calculateMatrixForDrag(itineraryStops: Stop[], draggedLocation: Location): void {
    // Consolidate all unique locations for the potential new itinerary.
    const allLocations = this.getUniqueLocations(itineraryStops, draggedLocation);

    if (allLocations.length < 2) {
      this.matrix.set(null);
      return;
    }

    // Create a stable cache key from the location IDs.
    const cacheKey = allLocations.map(loc => loc.id).sort().join(',');

    // Check if this exact matrix has already been calculated and is active.
    if (cacheKey === this.lastCalculatedKey) {
      console.log('MatrixService: Calculation skipped, data is already fresh.');
      return;
    }

    // Check if we have this result in our cache from a previous calculation.
    if (this.cache.has(cacheKey)) {
      console.log('MatrixService: Serving matrix from cache.');
      this.matrix.set(this.cache.get(cacheKey)!);
      this.lastCalculatedKey = cacheKey;
      return;
    }

    // 5. If not cached, fetch from the API.
    console.log('MatrixService: Fetching new matrix from API.');
    this.isLoading.set(true);
    this.error.set(null);
    this.lastCalculatedKey = null; // Invalidate last key until new one succeeds

    const coordinates = allLocations.map(loc => ({
      lat: loc.latitude,
      lng: loc.longitude,
    }));

    // The backend expects an array of JSON strings for the 'origins' query param
    const params = new HttpParams({
      fromObject: {
        origins: coordinates.map(coord => JSON.stringify(coord))
      }
    });

    this.http.get<CoordinateMatrix>(`${this.apiUrl}/route`, { params }).pipe(
      tap(result => {
        this.isLoading.set(false);
        this.cache.set(cacheKey, result);
        this.matrix.set(result);
        this.lastCalculatedKey = cacheKey;
        console.log('MatrixService: API fetch successful, matrix updated and cached.');
      }),
      catchError(err => {
        this.isLoading.set(false);
        this.error.set('Failed to calculate travel times. Please try again.');
        console.error('MatrixService: API Error:', err);
        return EMPTY; // Gracefully end the stream on error
      })
    ).subscribe();
  }

  /**
   * Helper to get a unique list of locations from itinerary stops and a new location.
   */
  private getUniqueLocations(stops: Stop[], newLocation: Location): Location[] {
    const locationsMap = new Map<string, Location>();
    stops.forEach(stop => {
      if (stop.locationDetails) {
        locationsMap.set(stop.locationDetails.id, stop.locationDetails);
      }
    });
    locationsMap.set(newLocation.id, newLocation);
    return Array.from(locationsMap.values());
  }

  /**
   * Transforms the raw API matrix into the Map<string, TravelSegmentData> format
   * needed by the ItineraryBuilderComponent.
   */
  private transformMatrixToSegments(matrix: CoordinateMatrix): Map<string, TravelSegmentData> {
    const formattedMap = new Map<string, TravelSegmentData>();

    for (const fromKey in matrix) {
      for (const toKey in matrix[fromKey]) {
        const cell = matrix[fromKey][toKey];
        const compositeKey = `${fromKey}_${toKey}`; // Create a key like "lat,lng_lat,lng"
        formattedMap.set(compositeKey, {
          time: this.formatTime(cell.time), // e.g., "15 min"
          distance: this.formatDistance(cell.distance) // e.g., "3.2 km"
        });
      }
    }
    return formattedMap;
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return '< 1 min';
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  private formatDistance(meters: number): string {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)} km`;
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Trip,
  TripSchema,
  CreateTripRequest,
  Location,
  TripBankedLocation,
  LocationForItinerary,
} from '@trip-planner/types';
import {
  CreateTripFromOrderedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import { UpdateTripWithRoutingRequest } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import { ITripServerRepository } from './interfaces/trip-server-repository.interface';
import { TempIdUtil } from '../../../core/utils/temp-id.util';

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

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(updateRequest, 'updateTrip');

    return this.http
      .put<Trip>(`${this.apiUrl}/trips/${tripId}`, updateRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  // Itinerary-specific operations

  /**
   * Create a trip with full itinerary data
   */
  createTripWithItinerary(
    tripData: {
      name: string;
      description?: string;
      startDate?: Date;
      endDate?: Date;
      matrix?: string;
    },
    organizedLocations: LocationForItinerary[],
  ): Observable<Trip> {
    const createRequest: CreateTripFromOrderedListDto = {
      name: tripData.name,
      description: tripData.description || undefined,
      startDate: tripData.startDate?.toISOString(),
      endDate: tripData.endDate?.toISOString(),
      matrix: tripData.matrix || undefined,
      organizedLocations: organizedLocations,
      bankedLocations: [],
      calculateRouting: true,
      travelMode: 'DRIVING',
    };

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(createRequest, 'createTripWithItinerary');

    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips`, createRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Add a stop to a persisted trip
   */
  addStopToTrip(tripId: string, location: Location, insertAtOrder?: number): Observable<Trip> {
    const addStopRequest: Omit<AddStopToTripDto, 'tripId'> = {
      locationId: location.id,
      insertAtOrder: insertAtOrder,
      calculateRouting: false,
      travelMode: 'DRIVING',
    };

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(addStopRequest, 'addStopToTrip');

    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops`, addStopRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Remove a stop from a persisted trip
   */
  removeStopFromTrip(tripId: string, stopId: string): Observable<Trip> {
    const params = new HttpParams().set('calculateRouting', 'true').set('travelMode', 'DRIVING');

    return this.http
      .delete<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops/${stopId}`, { params })
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Reorder stops in a persisted trip
   */
  reorderStopsInTrip(
    tripId: string,
    stopOrders: Array<{ stopId: string; newOrder: number }>,
  ): Observable<Trip> {
    const reorderRequest: Omit<ItineraryReorderStopsDto, 'tripId'> = {
      stopOrders: stopOrders,
      calculateRouting: false,
      travelMode: 'DRIVING',
    };

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(reorderRequest, 'reorderStopsInTrip');

    return this.http
      .put<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops/reorder`, reorderRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Add a location to bank
   */
  addBankedLocationToTrip(tripId: string, location: Location): Observable<TripBankedLocation> {
    const request = {
      locationId: location.id,
    };

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(request, 'addBankedLocationToTrip');

    return this.http.post<TripBankedLocation>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`, request);
  }

  /**
   * Remove a location from bank
   */
  removeBankedLocationFromTrip(tripId: string, locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}`);
  }

  /**
   * Promote a banked location to a stop
   */
  promoteBankedLocationToStop(
    tripId: string,
    locationId: string,
    position?: number,
  ): Observable<Trip> {
    const request = {
      locationId,
      position,
    };

    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(request, 'promoteBankedLocationToStop');

    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}/promote`, request)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Update trip with routing calculations
   */
  updateTripWithRouting(
    tripId: string,
    updateData: UpdateTripWithRoutingRequest,
  ): Observable<Trip> {
    // Validate no temp IDs are being sent
    TempIdUtil.validateNoTempIds(updateData, 'updateTripWithRouting');

    return this.http
      .put<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}`, updateData)
      .pipe(map(response => TripSchema.parse(response)));
  }

  // Read operations (queries)

  /**
   * Load trip with all relations from backend
   */
  loadTripWithRelations(tripId: string): Observable<Trip> {
    const params = new HttpParams()
      .set('includeStops', 'true')
      .set('includeBankedLocations', 'true')
      .set('includeTravelSegments', 'true');

    return this.http
      .get<Trip>(`${this.apiUrl}/trips/${tripId}`, { params })
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Get banked locations for a trip
   */
  getBankedLocations(tripId: string): Observable<TripBankedLocation[]> {
    return this.http.get<TripBankedLocation[]>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`);
  }

}

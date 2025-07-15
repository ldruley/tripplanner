import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, switchMap, map } from 'rxjs';
import {
  Trip,
  Location,
  TripBankedLocation,
  LocationForItinerary,
  TripSchema,
} from '@trip-planner/types';
import {
  CreateTripFromOrderedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import { UpdateTripWithRoutingRequest } from '../../../../../../../libs/shared/types/src/schemas/itinerary.schema';
import { environment } from '../../../../environments/environment';

/**
 * ItineraryApiService
 *
 * Handles all HTTP operations for itinerary management including:
 * - Trip creation with full itinerary data
 * - Stop management (add, remove, reorder)
 * - Banking operations (add/remove locations from bank)
 * - Trip updates with routing calculations
 */
@Injectable({
  providedIn: 'root',
})
export class ItineraryApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.backendApiUrl;

  /**
   * Create a trip with full itinerary data in the backend
   * @param tripData - Basic trip information
   * @param organizedLocations - Array of locations with order information
   * @returns Observable of created trip
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

    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips/batched`, createRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Add a stop to a persisted trip via backend API
   * @param tripId - ID of the trip
   * @param location - Location to add as a stop
   * @param insertAtOrder - Optional order position to insert at
   * @returns Observable of updated trip
   */
  addStopToTrip(tripId: string, location: Location, insertAtOrder?: number): Observable<Trip> {
    const addStopRequest: Omit<AddStopToTripDto, 'tripId'> = {
      locationId: location.id,
      insertAtOrder: insertAtOrder,
      calculateRouting: false,
      travelMode: 'DRIVING',
    };

    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops/batched`, addStopRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Remove a stop from a persisted trip via backend API
   * @param tripId - ID of the trip
   * @param stopId - ID of the stop to remove
   * @returns Observable of updated trip
   */
  removeStopFromTrip(tripId: string, stopId: string): Observable<Trip> {
    const params = new HttpParams().set('calculateRouting', 'true').set('travelMode', 'DRIVING');

    return this.http
      .delete<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops/${stopId}/batched`, { params })
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Reorder stops in a persisted trip via backend API
   * @param tripId - ID of the trip
   * @param stopOrders - Array of stop reordering instructions
   * @returns Observable of updated trip
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

    return this.http
      .put<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/stops/reorder/batched`, reorderRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Add a location to bank via backend API
   * @param tripId - ID of the trip
   * @param location - The location to add to bank
   * @returns Observable of created banked location
   */
  addBankedLocationToTrip(tripId: string, location: Location): Observable<TripBankedLocation> {
    // Since location already exists with ID from search, use it directly
    return this.http.post<TripBankedLocation>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`, {
      locationId: location.id,
    });
  }

  /**
   * Remove a location from bank via backend API
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to remove from bank
   * @returns Observable of void
   */
  removeBankedLocationFromTrip(tripId: string, locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}`);
  }

  /**
   * Get banked locations via backend API
   * @param tripId - ID of the trip
   * @returns Observable of banked locations
   */
  getBankedLocations(tripId: string): Observable<TripBankedLocation[]> {
    return this.http.get<TripBankedLocation[]>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`);
  }

  /**
   * Promote a banked location to a stop via backend API
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to promote
   * @param position - Optional position to insert stop at
   * @returns Observable of updated trip
   */
  promoteBankedLocationToStop(
    tripId: string,
    locationId: string,
    position?: number,
  ): Observable<Trip> {
    return this.http
      .post<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}/promote`, {
        locationId,
        position,
      })
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Update trip with routing calculations via backend API
   * @param tripId - ID of the trip
   * @param updateData - Trip update data with routing parameters
   * @returns Observable of updated trip
   */
  updateTripWithRouting(
    tripId: string,
    updateData: UpdateTripWithRoutingRequest,
  ): Observable<Trip> {
    return this.http
      .put<Trip>(`${this.apiUrl}/itinerary/trips/${tripId}`, updateData)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Load trip with all relations from backend
   * @param tripId - ID of the trip to load
   * @returns Observable of trip with all relations
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
}

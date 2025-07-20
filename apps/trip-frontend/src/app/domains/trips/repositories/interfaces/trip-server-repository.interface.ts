import { Observable } from 'rxjs';
import {
  Trip,
  Location,
  TripBankedLocation,
  LocationForItinerary,
} from '@trip-planner/types';
import { UpdateTripWithRoutingRequest } from '@trip-planner/types';

/**
 * Interface for trip server repository operations
 * Defines the contract for server-side trip write operations (commands only)
 * Read operations are handled by TripQueryService following CQRS pattern
 */
export interface ITripServerRepository {
  /**
   * Create a new trip
   * @param name - Name of the trip
   * @param description - Optional description of the trip
   */
  createTrip(name: string, description?: string): Observable<Trip>;

  /**
   * Update an existing trip
   * @param tripId - ID of the trip to update
   * @param updates - Partial trip data to update
   */
  updateTrip(tripId: string, updates: Partial<Trip>): Observable<Trip>;

  /**
   * Delete a trip by ID
   * @param tripId - ID of the trip to delete
   */
  deleteTrip(tripId: string): Observable<{ message: string }>;

  // Itinerary-specific operations

  /**
   * Create a trip with full itinerary data
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
  ): Observable<Trip>;

  /**
   * Add a stop to a persisted trip
   * @param tripId - ID of the trip
   * @param location - Location to add as a stop
   * @param insertAtOrder - Optional order position to insert at
   * @returns Observable of updated trip
   */
  addStopToTrip(tripId: string, location: Location, insertAtOrder?: number): Observable<Trip>;

  /**
   * Remove a stop from a persisted trip
   * @param tripId - ID of the trip
   * @param stopId - ID of the stop to remove
   * @returns Observable of updated trip
   */
  removeStopFromTrip(tripId: string, stopId: string): Observable<Trip>;

  /**
   * Reorder stops in a persisted trip
   * @param tripId - ID of the trip
   * @param stopOrders - Array of stop reordering instructions
   * @returns Observable of updated trip
   */
  reorderStopsInTrip(
    tripId: string,
    stopOrders: Array<{ stopId: string; newOrder: number }>,
  ): Observable<Trip>;

  /**
   * Add a location to bank
   * @param tripId - ID of the trip
   * @param location - The location to add to bank
   * @returns Observable of created banked location
   */
  addBankedLocationToTrip(tripId: string, location: Location): Observable<TripBankedLocation>;

  /**
   * Remove a location from bank
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to remove from bank
   * @returns Observable of void
   */
  removeBankedLocationFromTrip(tripId: string, locationId: string): Observable<void>;

  /**
   * Promote a banked location to a stop
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to promote
   * @param position - Optional position to insert stop at
   * @returns Observable of updated trip
   */
  promoteBankedLocationToStop(
    tripId: string,
    locationId: string,
    position?: number,
  ): Observable<Trip>;

  /**
   * Update trip with routing calculations
   * @param tripId - ID of the trip
   * @param updateData - Trip update data with routing parameters
   * @returns Observable of updated trip
   */
  updateTripWithRouting(
    tripId: string,
    updateData: UpdateTripWithRoutingRequest,
  ): Observable<Trip>;

  // Read operations (queries)

  /**
   * Load trip with all relations from backend
   * @param tripId - ID of the trip to load
   * @returns Observable of trip with all relations
   */
  loadTripWithRelations(tripId: string): Observable<Trip>;

  /**
   * Get banked locations for a trip
   * @param tripId - ID of the trip
   * @returns Observable of banked locations
   */
  getBankedLocations(tripId: string): Observable<TripBankedLocation[]>;
}

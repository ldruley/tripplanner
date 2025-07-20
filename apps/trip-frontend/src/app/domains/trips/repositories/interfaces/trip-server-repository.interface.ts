import { Observable } from 'rxjs';
import { Trip } from '@trip-planner/types';

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
}

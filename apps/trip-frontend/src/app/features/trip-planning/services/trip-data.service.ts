import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map, switchMap } from 'rxjs';
import {
  Trip,
  Location,
  Stop,
  TripBankedLocation,
  CreateTripRequest,
  UpdateTripRequest,
  CoordinateMatrix,
  TripSchema,
} from '@trip-planner/types';
import { environment } from '../../../../environments/environment';
import { stopsToLocationForItinerary } from '../../shared/services/location-transformation.utils';
import { MatrixCalculationService } from './matrix-calculation.service';
import { UpdateTripWithRoutingRequest } from '../../../../../../../libs/shared/types/src/schemas/itinerary.schema';
import { TripTimezoneService } from './trip-timezone.service';
import { ItineraryApiService } from './itinerary-api.service';
import { TripFacade, DataSource } from '../../../domains/trips';
import { PolylineGenerationService, PolylineGenerationOptions } from './polyline-generation.service';

// Re-export types for backward compatibility
export type { DataSource } from '../../../domains/trips';

@Injectable({
  providedIn: 'root',
})
export class TripDataService {
  private readonly http = inject(HttpClient);
  private readonly matrixCalculationService = inject(MatrixCalculationService);
  private readonly tripTimezoneService = inject(TripTimezoneService);
  private readonly itineraryApiService = inject(ItineraryApiService);
  private readonly tripFacade = inject(TripFacade);
  private readonly polylineGenerationService = inject(PolylineGenerationService);
  private readonly apiUrl = environment.backendApiUrl;

  // Delegate all reactive state to TripFacade (which wraps TripStateService)
  readonly currentTrip = this.tripFacade.currentTrip;
  readonly isLoading = this.tripFacade.isLoading;
  readonly isDirty = this.tripFacade.isDirty;
  readonly dataSource = this.tripFacade.dataSource;
  readonly error = this.tripFacade.error;
  readonly isOperationInProgress = this.tripFacade.isOperationInProgress;

  // Convenience computed properties
  readonly hasTrip = this.tripFacade.hasTrip;
  readonly tripId = this.tripFacade.tripId;
  readonly tripName = this.tripFacade.tripName;
  readonly tripDescription = this.tripFacade.tripDescription;
  readonly itineraryStops = this.tripFacade.itineraryStops;
  readonly bankedLocations = this.tripFacade.bankedLocations;
  readonly travelSegments = this.tripFacade.travelSegments;

  // Timeline-specific computed properties
  readonly sortedStops = this.tripFacade.sortedStops;
  readonly tripDuration = this.tripFacade.tripDuration;
  readonly hasScheduledStops = this.tripFacade.hasScheduledStops;
  readonly tripStartDate = this.tripFacade.tripStartDate;
  readonly tripEndDate = this.tripFacade.tripEndDate;

  // Timezone-aware computed properties
  readonly tripPrimaryTimezone = this.tripFacade.tripPrimaryTimezone;
  readonly tripPrimaryTimezoneDisplayName = this.tripFacade.tripPrimaryTimezoneDisplayName;
  readonly stopsWithTimezoneInfo = this.tripFacade.stopsWithTimezoneInfo;
  readonly formattedTripStartDate = this.tripFacade.formattedTripStartDate;
  readonly formattedTripEndDate = this.tripFacade.formattedTripEndDate;
  readonly tripDurationInTimezone = this.tripFacade.tripDurationInTimezone;

  /**
   * Initialize a trip based on ID ('new' for new trip, UUID for existing)
   */
  initializeTrip(tripId: string | 'new'): void {
    if (tripId === 'new') {
      // Create new draft trip using facade
      this.tripFacade.startNewDraftTrip('New Untitled Trip');
      // Clear matrix for new trips - use local calculation
      this.matrixCalculationService.clearPersistedMatrix();
    } else {
      // Load existing trip using facade
      this.tripFacade.loadTrip(tripId).subscribe({
        next: trip => {
          if (trip) {
            // Load persisted matrix for persisted trips
            this.loadPersistedMatrix(trip);
          } else {
            console.warn('TripDataService: Trip not found:', tripId);
          }
        },
        error: error => {
          console.error('TripDataService: Failed to load trip:', error);
        }
      });
    }
  }

  /**
   * Update trip locally (triggers auto-save for drafts)
   */
  updateTripLocal(updates: Partial<Trip>): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // For persisted trips, use the facade's update method
    if (this.dataSource() === 'persisted') {
      this.tripFacade.updateTripDetails(currentTrip.id, updates).subscribe({
        error: error => {
          console.error('TripDataService: Failed to update persisted trip:', error);
        }
      });
    } else {
      // For draft/new trips, use the facade's local update method
      this.tripFacade.updateTripLocally({
        ...updates,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Add a location to the trip's banked locations using facade
   * TODO: matrix calculation needs refactoring
   */
  addLocationToBank(location: Location): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if location is already banked
    const existingBanked = currentTrip.bankedLocations.find(bl => bl.locationId === location.id);
    if (existingBanked) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      // For persisted trips, still use the itinerary API for complex operations
      this.itineraryApiService.addBankedLocationToTrip(currentTrip.id, location).subscribe({
        next: bankedLocation => {
          // Ensure the banked location includes the full location object
          const bankedLocationWithFullLocation: TripBankedLocation = {
            ...bankedLocation,
            location: location, // Use the original location object to ensure all data is available
          };

          // Update local state with the response using local update
          this.updateTripLocal({
            bankedLocations: [...currentTrip.bankedLocations, bankedLocationWithFullLocation],
          });

          // Trigger matrix calculation for enhanced reordering without additional API calls
          this.updateMatrixForTrip();
        },
        error: (error: any) => {
          console.error('Failed to add location to bank:', error);
        },
      });
    } else {
      // For local/draft trips, use facade
      this.tripFacade.addBankedLocation(currentTrip.id, location).subscribe({
        next: () => {
          // Trigger matrix calculation for enhanced reordering without additional API calls
          this.updateMatrixForTrip();
        },
        error: error => {
          console.error('TripDataService: Failed to add banked location via facade:', error);
        }
      });
    }
  }

  /**
   * Remove a location from the trip's banked locations using facade
   */
  removeLocationFromBank(locationId: string): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      // For persisted trips, still use the itinerary API for complex operations
      this.itineraryApiService.removeBankedLocationFromTrip(currentTrip.id, locationId).subscribe({
        next: () => {
          // Update local state by removing the location
          this.updateTripLocal({
            bankedLocations: currentTrip.bankedLocations.filter(bl => bl.locationId !== locationId),
          });
        },
        error: (error: any) => {
          console.error('Failed to remove location from bank:', error);
        },
      });
    } else {
      // For local/draft trips, use facade
      this.tripFacade.removeBankedLocation(currentTrip.id, locationId).subscribe({
        error: error => {
          console.error('TripDataService: Failed to remove banked location via facade:', error);
        }
      });
    }
  }

  /**
   * Helper method to update matrix for current trip
   */
  private updateMatrixForTrip(): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    this.matrixCalculationService
      .calculateMatrix([
        ...currentTrip.stops.map(s => s.location).filter((loc): loc is Location => !!loc),
        ...currentTrip.bankedLocations
          .map(bl => bl.location)
          .filter((loc): loc is Location => !!loc),
      ])
      .subscribe({
        next: (matrix: CoordinateMatrix) => {
          this.updateTripLocal({ matrix: JSON.stringify(matrix) });
        },
        error: (error: any) => {
          console.warn('Failed to update matrix:', error);
        },
      });
  }

  /**
   * Add a stop to the trip's itinerary using facade
   */
  addStopToItinerary(location: Location, insertAtIndex?: number): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      // For persisted trips, still use the itinerary API for complex operations
      // This maintains the existing behavior for backend integration

      // Optimistic update - apply change locally first
      const targetOrder = insertAtIndex !== undefined ? insertAtIndex : currentTrip.stops.length;

      const optimisticStop: Stop = {
        id: crypto.randomUUID(), // Generate proper UUID for optimistic update
        tripId: currentTrip.id,
        locationId: location.id,
        order: targetOrder,
        plannedArrivalTime: null,
        plannedDuration: null,
        calculatedArrivalTime: null,
        calculatedDepartureTime: null,
        stopType: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        location,
      };

      // Update local state optimistically
      let optimisticStops = [...currentTrip.stops];
      if (insertAtIndex !== undefined) {
        optimisticStops = optimisticStops.map(stop =>
          stop.order >= insertAtIndex ? { ...stop, order: stop.order + 1 } : stop,
        );
      }
      optimisticStops.push(optimisticStop);
      optimisticStops.sort((a, b) => a.order - b.order);

      // Use local update with operation in progress
      this.updateTripLocal({ 
        stops: optimisticStops
      });

      // Make backend call
      this.itineraryApiService.addStopToTrip(currentTrip.id, location, insertAtIndex).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateTripLocal(parsedTrip);
          // Load updated matrix for persisted trips after stop addition
          this.loadPersistedMatrix(parsedTrip);
        },
        error: error => {
          console.error('TripDataService: Failed to add stop to backend trip:', error);
          // Rollback optimistic update
          this.updateTripLocal(currentTrip);
        },
      });
      return;
    }

    // For local trips (new/draft), use facade
    this.tripFacade.addStop(currentTrip.id, location, insertAtIndex).subscribe({
      error: error => {
        console.error('TripDataService: Failed to add stop via facade:', error);
      }
    });
  }

  /**
   * Remove a stop from the trip's itinerary using facade
   */
  removeStopFromItinerary(stopId: string): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      // For persisted trips, still use the itinerary API for complex operations
      this.itineraryApiService.removeStopFromTrip(currentTrip.id, stopId).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateTripLocal(parsedTrip);
        },
        error: error => {
          console.error('TripDataService: Failed to remove stop from backend trip:', error);
        },
      });
      return;
    }

    // For local trips (new/draft), use facade
    this.tripFacade.removeStop(currentTrip.id, stopId).subscribe({
      error: error => {
        console.error('TripDataService: Failed to remove stop via facade:', error);
      }
    });
  }

  /**
   * Reorder stops in the itinerary
   */
  reorderStops(newOrder: string[]): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      const stopOrders = newOrder.map((stopId, index) => ({
        stopId,
        newOrder: index,
      }));

      this.itineraryApiService.reorderStopsInTrip(currentTrip.id, stopOrders).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateTripLocal(parsedTrip);
        },
        error: error => {
          console.error('TripDataService: Failed to reorder stops in backend trip:', error);
          console.error('Failed to reorder stops:', error.message);
        },
      });
      return;
    }

    // Handle local trip (new/draft)
    const updatedStops = newOrder.map((stopId, index) => {
      const stop = currentTrip.stops.find(s => s.id === stopId);
      if (!stop) throw new Error(`Stop with ID ${stopId} not found`);
      return { ...stop, order: index };
    });

    this.updateTripLocal({
      stops: updatedStops,
    });
  }

  /**
   * Update a specific stop using facade
   */
  updateStop(stopId: string, updates: Partial<Stop>): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    this.tripFacade.updateStop(currentTrip.id, stopId, updates).subscribe({
      error: error => {
        console.error('TripDataService: Failed to update stop via facade:', error);
      }
    });
  }

  /**
   * Save trip to backend (creates if new, updates if existing)
   */
  saveTripToBackend(): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      return of(null as any);
    }

    const isNewTrip = this.dataSource() === 'new' || this.dataSource() === 'draft';

    // For new trips with stops, use the itinerary endpoint for rich data persistence
    if (isNewTrip && currentTrip.stops.length > 0) {
      const organizedLocations = stopsToLocationForItinerary(currentTrip.stops);

      const apiCall = this.itineraryApiService.createTripWithItinerary(
        {
          name: currentTrip.name,
          description: currentTrip.description || undefined,
          startDate: currentTrip.startDate || undefined,
          endDate: currentTrip.endDate || undefined,
          matrix: currentTrip.matrix || undefined,
        },
        organizedLocations,
      );

      return apiCall.pipe(
        tap(savedTrip => {
          // Update state to reflect persisted trip using facade
          this.tripFacade.loadTrip(savedTrip.id).subscribe();
        }),
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to save trip:', errorMessage);
          throw error;
        }),
      );
    }

    // For trips without stops or existing trips, use facade methods
    if (isNewTrip) {
      return this.tripFacade.createTrip(currentTrip.name, currentTrip.description || undefined).pipe(
        switchMap(result => {
          // Load the newly created trip
          return this.tripFacade.loadTrip(result.tripId);
        }),
        map(trip => trip!), // We know trip exists at this point
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to save trip:', errorMessage);
          throw error;
        })
      );
    } else {
      return this.tripFacade.updateTripDetails(currentTrip.id, {
        name: currentTrip.name,
        description: currentTrip.description,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate,
        matrix: currentTrip.matrix
      }).pipe(
        map(() => this.currentTrip()!), // Return current trip after update
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to save trip:', errorMessage);
          throw error;
        })
      );
    }
  }

  /**
   * Clear current trip state
   */
  clearTrip(): void {
    this.tripFacade.clearCurrentTrip();
  }

  /**
   * Check if the current trip matches the given trip ID
   * Used to prevent unnecessary re-initialization during route changes
   */
  currentTripMatchesId(tripId: string): boolean {
    const currentTrip = this.currentTrip();
    const currentDataSource = this.dataSource();

    console.log('TripDataService: currentTripMatchesId check:', {
      tripId,
      currentTripId: currentTrip?.id,
      currentDataSource,
      hasCurrentTrip: !!currentTrip
    });

    if (!currentTrip) {
      console.log('TripDataService: No current trip, returning false');
      return false;
    }

    // Handle 'new' route case
    if (tripId === 'new') {
      const matches = currentDataSource === 'new';
      console.log('TripDataService: Checking new route, dataSource matches:', matches);
      return matches;
    }

    // Handle existing trip ID case
    const matches = currentTrip.id === tripId;
    console.log('TripDataService: Checking existing trip ID, IDs match:', matches);
    return matches;
  }

  /**
   * Timeline-specific methods for future timeline view
   */

  /**
   * Update trip dates (useful for timeline view)
   */
  updateTripDates(startDate: Date | null, endDate: Date | null): void {
    this.updateTripLocal({ startDate, endDate });
  }

  /**
   * Update trip dates with timezone awareness
   */
  updateTripDatesInTimezone(startDate: Date | null, endDate: Date | null, timezone?: string): void {
    const currentTrip = this.currentTrip();
    const { startDate: utcStartDate, endDate: utcEndDate } =
      this.tripTimezoneService.convertTripDatesToUTC(startDate, endDate, timezone, currentTrip);

    this.updateTripLocal({ startDate: utcStartDate, endDate: utcEndDate });
  }

  /**
   * Update stop timing information
   */
  updateStopTiming(
    stopId: string,
    timing: {
      plannedArrivalTime?: Date | null;
      plannedDuration?: number | null;
      calculatedArrivalTime?: Date | null;
      calculatedDepartureTime?: Date | null;
    },
  ): void {
    this.updateStop(stopId, timing);
  }

  /**
   * Update stop timing with timezone awareness
   */
  updateStopTimingInTimezone(
    stopId: string,
    timing: {
      plannedArrivalTime?: Date | null;
      plannedDuration?: number | null;
    },
  ): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    const stop = currentTrip.stops.find(s => s.id === stopId);
    if (!stop || !stop.location) return;

    const utcTiming = this.tripTimezoneService.convertStopTimingToUTC(stop.location, timing);
    this.updateStop(stopId, utcTiming);
  }

  /**
   * Get stops with timing information for timeline views
   */
  getStopsWithTiming(): Stop[] {
    return this.tripFacade.getStopsWithTiming();
  }

  /**
   * Calculate total planned duration for the trip
   */
  getTotalPlannedDuration(): number {
    return this.tripFacade.getTotalPlannedDuration();
  }

  /**
   * Get the next stop in the timeline
   */
  getNextStop(currentStopId: string): Stop | null {
    return this.tripFacade.getNextStop(currentStopId);
  }

  /**
   * Get the previous stop in the timeline
   */
  getPreviousStop(currentStopId: string): Stop | null {
    return this.tripFacade.getPreviousStop(currentStopId);
  }

  /**
   * Promote a banked location to a stop
   * @param locationId - ID of the location to promote
   * @param position - Optional position to insert stop at
   * @returns Observable of updated trip
   */
  promoteBankedLocationToStop(locationId: string, position?: number): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to promote banked location in');
    }

    return this.itineraryApiService
      .promoteBankedLocationToStop(currentTrip.id, locationId, position)
      .pipe(
        tap(updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateTripLocal(parsedTrip);
        }),
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to promote banked location:', errorMessage);
          throw error;
        }),
      );
  }

  /**
   * Update trip with routing calculations
   * @param updateData - Trip update data with routing parameters
   * @returns Observable of updated trip
   */
  updateTripWithRouting(updateData: UpdateTripWithRoutingRequest): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to update with routing');
    }

    return this.itineraryApiService.updateTripWithRouting(currentTrip.id, updateData).pipe(
      tap(updatedTrip => {
        // Use Zod to parse and coerce dates
        const parsedTrip = TripSchema.parse(updatedTrip);
        this.updateTripLocal(parsedTrip);
      }),
      catchError((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to update trip with routing:', errorMessage);
        throw error;
      }),
    );
  }

  // Private helper methods

  /**
   * Generate polylines for trip visualization
   * @param options - Generation options including travel mode and force recalculate
   * @returns Observable of updated trip with polylines
   */
  generatePolylines(options: PolylineGenerationOptions = {}): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to generate polylines for');
    }

    return this.polylineGenerationService.generatePolylines(currentTrip.id, options).pipe(
      tap(updatedTrip => {
        // Use Zod to parse and coerce dates
        const parsedTrip = TripSchema.parse(updatedTrip);
        this.updateTripLocal(parsedTrip);
      }),
      catchError((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to generate polylines:', errorMessage);
        throw error;
      }),
    );
  }

  /**
   * Check polyline status for current trip
   * @returns Observable of polyline status
   */
  getPolylineStatus(): Observable<{
    needsPolylines: boolean;
    hasCompleteRouting: boolean;
    segmentCount: number;
    segmentsWithPolylines: number;
  }> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to check polyline status for');
    }

    return this.polylineGenerationService.getPolylineStatus(currentTrip.id);
  }

  /**
   * Get polyline generation loading state
   */
  get isGeneratingPolylines() {
    return this.polylineGenerationService.isGenerating;
  }

  /**
   * Get polyline generation error state
   */
  get polylineError() {
    return this.polylineGenerationService.error;
  }

  /**
   * Clear polyline generation error
   */
  clearPolylineError(): void {
    this.polylineGenerationService.clearError();
  }

  /**
   * Load persisted matrix data from trip and set it in MatrixCalculationService
   */
  private loadPersistedMatrix(trip: Trip): void {
    if (!trip.matrix) {
      console.log('TripDataService: No persisted matrix data found for trip');
      this.matrixCalculationService.setPersistedMatrix(null);
      return;
    }

    try {
      // Parse matrix from JSON if it's a string, or use directly if already parsed
      const matrix: CoordinateMatrix =
        typeof trip.matrix === 'string' ? JSON.parse(trip.matrix) : trip.matrix;

      console.log('TripDataService: Loading persisted matrix data for trip:', trip.id);
      this.matrixCalculationService.setPersistedMatrix(matrix);
    } catch (error) {
      console.error('TripDataService: Failed to parse persisted matrix data:', error);
      this.matrixCalculationService.setPersistedMatrix(null);
    }
  }
}

import { Injectable, inject, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
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
import { TripDraftStore } from './trip-draft-store.service';
import { TripStateService, DataSource } from './trip-state.service';

// Re-export types for backward compatibility
export type { DataSource } from './trip-state.service';

@Injectable({
  providedIn: 'root',
})
export class TripDataService {
  private readonly http = inject(HttpClient);
  private readonly matrixCalculationService = inject(MatrixCalculationService);
  private readonly tripTimezoneService = inject(TripTimezoneService);
  private readonly itineraryApiService = inject(ItineraryApiService);
  private readonly tripDraftStore = inject(TripDraftStore);
  private readonly tripStateService = inject(TripStateService);
  private readonly apiUrl = environment.backendApiUrl;

  // Delegate all reactive state to TripStateService
  readonly currentTrip = this.tripStateService.currentTrip;
  readonly isLoading = this.tripStateService.isLoading;
  readonly isDirty = this.tripStateService.isDirty;
  readonly dataSource = this.tripStateService.dataSource;
  readonly error = this.tripStateService.error;
  readonly isOperationInProgress = this.tripStateService.isOperationInProgress;

  // Convenience computed properties
  readonly hasTrip = this.tripStateService.hasTrip;
  readonly tripId = this.tripStateService.tripId;
  readonly tripName = this.tripStateService.tripName;
  readonly tripDescription = this.tripStateService.tripDescription;
  readonly itineraryStops = this.tripStateService.itineraryStops;
  readonly bankedLocations = this.tripStateService.bankedLocations;
  readonly travelSegments = this.tripStateService.travelSegments;

  // Timeline-specific computed properties
  readonly sortedStops = this.tripStateService.sortedStops;
  readonly tripDuration = this.tripStateService.tripDuration;
  readonly hasScheduledStops = this.tripStateService.hasScheduledStops;
  readonly tripStartDate = this.tripStateService.tripStartDate;
  readonly tripEndDate = this.tripStateService.tripEndDate;

  // Timezone-aware computed properties
  readonly tripPrimaryTimezone = this.tripStateService.tripPrimaryTimezone;
  readonly tripPrimaryTimezoneDisplayName = this.tripStateService.tripPrimaryTimezoneDisplayName;
  readonly stopsWithTimezoneInfo = this.tripStateService.stopsWithTimezoneInfo;
  readonly formattedTripStartDate = this.tripStateService.formattedTripStartDate;
  readonly formattedTripEndDate = this.tripStateService.formattedTripEndDate;
  readonly tripDurationInTimezone = this.tripStateService.tripDurationInTimezone;

  /**
   * Initialize a trip based on ID ('new' for new trip, UUID for existing)
   */
  initializeTrip(tripId: string | 'new'): void {
    this.tripStateService.setLoading(true);
    this.tripStateService.setError(null);

    if (tripId === 'new') {
      // Create new trip
      const newTrip: Trip = {
        id: crypto.randomUUID(),
        userId: '', // Will be set when saved to backend
        name: 'New Untitled Trip',
        description: null,
        startDate: null,
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        needsRoutingRecalculation: false,
        needsTimelineRecalculation: false,
        stops: [],
        bankedLocations: [],
        travelSegments: [],
      };

      this.tripStateService.setTrip(newTrip, 'new', false);
      this.tripStateService.setLoading(false);
      // Clear matrix for new trips - use local calculation
      this.matrixCalculationService.clearPersistedMatrix();
    } else {
      // Try to load from localStorage first (draft)
      const draftTrip = this.tripDraftStore.loadDraft(tripId);
      if (draftTrip) {
        this.tripStateService.setTrip(draftTrip, 'draft', true);
        this.tripStateService.setLoading(false);
        // Clear matrix for draft trips - use local calculation
        this.matrixCalculationService.clearPersistedMatrix();
      } else {
        // Load from backend
        this.itineraryApiService.loadTripWithRelations(tripId).subscribe({
          next: trip => {
            // Use Zod to parse and coerce dates
            const parsedTrip = TripSchema.parse(trip);

            this.tripStateService.setTrip(parsedTrip, 'persisted', false);
            this.tripStateService.setLoading(false);
            // Load persisted matrix for persisted trips
            this.loadPersistedMatrix(parsedTrip);
          },
          error: error => {
            console.error('TripDataService: Failed to load trip from backend:', error);
            this.tripStateService.setLoading(false);
            this.tripStateService.setError(`Failed to load trip: ${error.message}`);
          },
        });
      }
    }
  }

  /**
   * Update trip locally (triggers auto-save for drafts)
   */
  updateTripLocal(updates: Partial<Trip>): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    const updatedTrip: Trip = {
      ...currentTrip,
      ...updates,
      updatedAt: new Date(),
    };

    this.tripStateService.updateState({
      trip: updatedTrip,
      isDirty: true,
    });

    // Trigger auto-save for non-persisted trips
    if (this.dataSource() !== 'persisted') {
      this.tripDraftStore.scheduleAutoSave(updatedTrip);
    }
  }

  /**
   * Add a location to the trip's banked locations
   * TODO: this is messy, matrix calculation needs refactoring
   */
  addLocationToBank(location: Location): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if location is already banked
    const existingBanked = currentTrip.bankedLocations.find(bl => bl.locationId === location.id);
    if (existingBanked) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      this.itineraryApiService.addBankedLocationToTrip(currentTrip.id, location).subscribe({
        next: bankedLocation => {
          // Ensure the banked location includes the full location object
          const bankedLocationWithFullLocation: TripBankedLocation = {
            ...bankedLocation,
            location: location, // Use the original location object to ensure all data is available
          };

          // Update local state with the response
          const updatedTrip = {
            ...currentTrip,
            bankedLocations: [...currentTrip.bankedLocations, bankedLocationWithFullLocation],
          };
          this.tripStateService.updateState({
            trip: updatedTrip,
            isDirty: false,
          });

          // Trigger matrix calculation for enhanced reordering without additional API calls
          this.matrixCalculationService
            .calculateMatrix([
              ...updatedTrip.stops.map(s => s.location).filter((loc): loc is Location => !!loc),
              ...updatedTrip.bankedLocations
                .map(bl => bl.location)
                .filter((loc): loc is Location => !!loc),
            ])
            .subscribe({
              next: (matrix: CoordinateMatrix) => {
                this.updateTripLocal({ matrix: JSON.stringify(matrix) });
              },
              error: (error: any) => {
                console.warn('Failed to update matrix after banking location:', error);
                // Don't show error to user as banking still succeeded
              },
            });
        },
        error: (error: any) => {
          console.error('Failed to add location to bank:', error);
          this.tripStateService.setError('Failed to add location to bank');
        },
      });
    } else {
      // For local/draft trips, add location directly to local state
      const bankedLocation: TripBankedLocation = {
        id: crypto.randomUUID(),
        tripId: currentTrip.id,
        locationId: location.id,
        createdAt: new Date(),
        location,
      };

      const updatedTrip = {
        ...currentTrip,
        bankedLocations: [...currentTrip.bankedLocations, bankedLocation],
      };
      this.updateTripLocal({
        bankedLocations: updatedTrip.bankedLocations,
      });

      // Trigger matrix calculation for enhanced reordering without additional API calls
      this.matrixCalculationService
        .calculateMatrix([
          ...updatedTrip.stops.map(s => s.location).filter((loc): loc is Location => !!loc),
          ...updatedTrip.bankedLocations
            .map(bl => bl.location)
            .filter((loc): loc is Location => !!loc),
        ])
        .subscribe({
          next: (matrix: CoordinateMatrix) => {
            this.updateTripLocal({ matrix: JSON.stringify(matrix) });
          },
          error: (error: any) => {
            console.warn('Failed to update matrix after banking location:', error);
          },
        });
    }
  }

  /**
   * Remove a location from the trip's banked locations
   */
  removeLocationFromBank(locationId: string): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      this.itineraryApiService.removeBankedLocationFromTrip(currentTrip.id, locationId).subscribe({
        next: () => {
          // Update local state by removing the location
          const updatedTrip = {
            ...currentTrip,
            bankedLocations: currentTrip.bankedLocations.filter(bl => bl.locationId !== locationId),
          };
          this.updateTripLocal({
            bankedLocations: updatedTrip.bankedLocations,
          });
        },
        error: (error: any) => {
          console.error('Failed to remove location from bank:', error);
          this.tripStateService.setError('Failed to remove location from bank');
        },
      });
    } else {
      // For local/draft trips, remove location directly from local state
      const updatedTrip = {
        ...currentTrip,
        bankedLocations: currentTrip.bankedLocations.filter(bl => bl.locationId !== locationId),
      };
      this.updateTripLocal({
        bankedLocations: updatedTrip.bankedLocations,
      });
    }
  }

  /**
   * Add a stop to the trip's itinerary
   */
  addStopToItinerary(location: Location, insertAtIndex?: number): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
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

      this.tripStateService.updateState({
        trip: { ...currentTrip, stops: optimisticStops },
        isOperationInProgress: true,
        error: null,
      });

      // Make backend call
      this.itineraryApiService.addStopToTrip(currentTrip.id, location, insertAtIndex).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.tripStateService.updateState({
            trip: parsedTrip,
            isDirty: false,
            isOperationInProgress: false,
          });
          // Load updated matrix for persisted trips after stop addition
          this.loadPersistedMatrix(parsedTrip);
        },
        error: error => {
          console.error('TripDataService: Failed to add stop to backend trip:', error);
          // Rollback optimistic update
          this.tripStateService.updateState({
            trip: currentTrip,
            isOperationInProgress: false,
            error: `Failed to add stop: ${error.message}`,
          });
        },
      });
      return;
    }

    // Handle local trip (new/draft)
    // Determine the order for the new stop
    const targetOrder = insertAtIndex !== undefined ? insertAtIndex : currentTrip.stops.length;

    // Create new stop
    const newStop: Stop = {
      id: crypto.randomUUID(),
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

    // Update orders for existing stops if inserting
    let updatedStops = [...currentTrip.stops];
    if (insertAtIndex !== undefined) {
      updatedStops = updatedStops.map(stop =>
        stop.order >= insertAtIndex ? { ...stop, order: stop.order + 1 } : stop,
      );
    }

    // Add new stop
    updatedStops.push(newStop);

    // Sort by order
    updatedStops.sort((a, b) => a.order - b.order);

    this.updateTripLocal({
      stops: updatedStops,
    });
  }

  /**
   * Remove a stop from the trip's itinerary
   */
  removeStopFromItinerary(stopId: string): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      this.itineraryApiService.removeStopFromTrip(currentTrip.id, stopId).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.tripStateService.updateState({
            trip: parsedTrip,
            isDirty: false,
          });
        },
        error: error => {
          console.error('TripDataService: Failed to remove stop from backend trip:', error);
          this.tripStateService.updateState({
            error: `Failed to remove stop: ${error.message}`,
          });
        },
      });
      return;
    }

    // Handle local trip (new/draft)
    const stopToRemove = currentTrip.stops.find(s => s.id === stopId);
    if (!stopToRemove) return;

    // Remove stop and update orders
    const updatedStops = currentTrip.stops
      .filter(s => s.id !== stopId)
      .map(stop => (stop.order > stopToRemove.order ? { ...stop, order: stop.order - 1 } : stop))
      .sort((a, b) => a.order - b.order);

    this.updateTripLocal({
      stops: updatedStops,
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
          this.tripStateService.updateState({
            trip: parsedTrip,
            isDirty: false,
          });
        },
        error: error => {
          console.error('TripDataService: Failed to reorder stops in backend trip:', error);
          this.tripStateService.updateState({
            error: `Failed to reorder stops: ${error.message}`,
          });
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
   * Update a specific stop
   */
  updateStop(stopId: string, updates: Partial<Stop>): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    const updatedStops = currentTrip.stops.map(stop =>
      stop.id === stopId ? { ...stop, ...updates, updatedAt: new Date() } : stop,
    );

    this.updateTripLocal({
      stops: updatedStops,
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

    this.tripStateService.setLoading(true);
    this.tripStateService.setError(null);

    const isNewTrip = this.dataSource() === 'new';

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
          // Clear draft from localStorage
          this.tripDraftStore.clearDraft(currentTrip.id);

          // Update state to reflect persisted trip
          this.tripStateService.updateState({
            trip: savedTrip,
            isLoading: false,
            isDirty: false,
            dataSource: 'persisted',
          });
        }),
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.tripStateService.updateState({
            isLoading: false,
            error: `Failed to save trip: ${errorMessage}`,
          });
          throw error;
        }),
      );
    }

    // For trips without stops or existing trips, use basic trip endpoints
    const apiCall = isNewTrip
      ? this.createTripInBackend(currentTrip)
      : this.updateTripInBackend(currentTrip);

    return apiCall.pipe(
      tap(savedTrip => {
        // Clear draft from localStorage
        this.tripDraftStore.clearDraft(currentTrip.id);

        // Use Zod to parse and coerce dates
        const parsedTrip = TripSchema.parse(savedTrip);

        // Update state to reflect persisted trip
        this.tripStateService.updateState({
          trip: parsedTrip,
          isLoading: false,
          isDirty: false,
          dataSource: 'persisted',
        });
      }),
      catchError((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.tripStateService.updateState({
          isLoading: false,
          error: `Failed to save trip: ${errorMessage}`,
        });
        throw error;
      }),
    );
  }

  /**
   * Clear current trip state
   */
  clearTrip(): void {
    this.tripStateService.clearState();
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
    return this.tripStateService.getStopsWithTiming();
  }

  /**
   * Calculate total planned duration for the trip
   */
  getTotalPlannedDuration(): number {
    return this.tripStateService.getTotalPlannedDuration();
  }

  /**
   * Get the next stop in the timeline
   */
  getNextStop(currentStopId: string): Stop | null {
    return this.tripStateService.getNextStop(currentStopId);
  }

  /**
   * Get the previous stop in the timeline
   */
  getPreviousStop(currentStopId: string): Stop | null {
    return this.tripStateService.getPreviousStop(currentStopId);
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
          this.tripStateService.updateState({
            trip: parsedTrip,
            isDirty: false,
          });
        }),
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.tripStateService.setError(`Failed to promote banked location: ${errorMessage}`);
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
        this.tripStateService.updateState({
          trip: parsedTrip,
          isDirty: false,
        });
      }),
      catchError((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.tripStateService.setError(`Failed to update trip with routing: ${errorMessage}`);
        throw error;
      }),
    );
  }

  // Private helper methods for basic trip operations

  /**
   * Create trip in backend
   */
  private createTripInBackend(trip: Trip): Observable<Trip> {
    const createRequest: CreateTripRequest = {
      name: trip.name,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      matrix: trip.matrix,
    };

    return this.http
      .post<Trip>(`${this.apiUrl}/trips`, createRequest)
      .pipe(map(response => TripSchema.parse(response)));
  }

  /**
   * Update trip in backend
   */
  private updateTripInBackend(trip: Trip): Observable<Trip> {
    const updateRequest: UpdateTripWithRoutingRequest = {
      name: trip.name,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
      calculateRouting: false,
      travelMode: 'DRIVING',
      forceRecalculate: false,
    };

    return this.http
      .put<Trip>(`${this.apiUrl}/itinerary/trips/${trip.id}`, updateRequest)
      .pipe(map(response => TripSchema.parse(response)));
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

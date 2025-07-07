import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, tap, catchError, of } from 'rxjs';
import {
  Trip,
  Location,
  Stop,
  TripBankedLocation,
  CreateTripRequest,
  UpdateTripRequest,
  LocationForItinerary,
  CoordinateMatrix,
} from '@trip-planner/types';
import {
  CreateTripFromOrganizedListDto,
  AddStopToTripDto,
  RemoveStopFromTripDto,
  ItineraryReorderStopsDto,
} from '@trip-planner/shared/dtos';
import { LocalStorageService } from '../../../core/services/local-storage.service';
import { environment } from '../../../../environments/environment';
import {
  locationToLocationForItinerary,
  stopsToLocationForItinerary,
  searchLocationToLocationForItinerary,
} from './location-transformation.utils';
import { MatrixCalculationService } from './matrix-calculation.service';
import { UpdateTripWithRoutingRequest } from '../../../../../../../libs/shared/types/src/schemas/itinerary.schema';

export type DataSource = 'new' | 'draft' | 'persisted';

export interface TripState {
  trip: Trip | null;
  isLoading: boolean;
  isDirty: boolean;
  dataSource: DataSource;
  error: string | null;
  isOperationInProgress: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TripDataService {
  private readonly http = inject(HttpClient);
  private readonly localStorage = inject(LocalStorageService);
  private readonly matrixCalculationService = inject(MatrixCalculationService);
  private readonly apiUrl = environment.backendApiUrl;

  // Auto-save debouncing
  private readonly autoSaveSubject = new Subject<Trip>();
  private readonly AUTO_SAVE_DEBOUNCE_TIME = 5000; // 5 seconds

  // Internal state
  private readonly _state = signal<TripState>({
    trip: null,
    isLoading: false,
    isDirty: false,
    dataSource: 'new',
    error: null,
    isOperationInProgress: false,
  });

  // Public reactive state
  readonly currentTrip = computed(() => this._state().trip);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly isDirty = computed(() => this._state().isDirty);
  readonly dataSource = computed(() => this._state().dataSource);
  readonly error = computed(() => this._state().error);
  readonly isOperationInProgress = computed(() => this._state().isOperationInProgress);

  // Convenience computed properties
  readonly hasTrip = computed(() => !!this.currentTrip());
  readonly tripId = computed(() => this.currentTrip()?.id || null);
  readonly tripName = computed(() => this.currentTrip()?.name || '');
  readonly tripDescription = computed(() => this.currentTrip()?.description || '');
  readonly itineraryStops = computed(() => this.currentTrip()?.stops || []);
  readonly bankedLocations = computed(() => this.currentTrip()?.bankedLocations || []);
  readonly travelSegments = computed(() => this.currentTrip()?.travelSegments || []);

  // Timeline-specific computed properties
  readonly sortedStops = computed(() =>
    [...this.itineraryStops()].sort((a, b) => a.order - b.order),
  );
  readonly tripDuration = computed(() => {
    const stops = this.sortedStops();
    if (stops.length === 0) return null;

    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];

    if (!firstStop.calculatedArrivalTime || !lastStop.calculatedDepartureTime) {
      return null;
    }

    const start = new Date(firstStop.calculatedArrivalTime);
    const end = new Date(lastStop.calculatedDepartureTime);
    return end.getTime() - start.getTime(); // Duration in milliseconds
  });
  readonly hasScheduledStops = computed(() =>
    this.sortedStops().some(stop => !!stop.plannedArrivalTime),
  );
  readonly tripStartDate = computed(() => this.currentTrip()?.startDate || null);
  readonly tripEndDate = computed(() => this.currentTrip()?.endDate || null);

  constructor() {
    this.initializeAutoSave();
  }

  /**
   * Initialize a trip based on ID ('new' for new trip, UUID for existing)
   */
  initializeTrip(tripId: string | 'new'): void {
    this.updateState({ isLoading: true, error: null });

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
        stops: [],
        bankedLocations: [],
        travelSegments: [],
      };

      this.updateState({
        trip: newTrip,
        isLoading: false,
        isDirty: false,
        dataSource: 'new',
      });
      // Clear matrix for new trips - use local calculation
      this.matrixCalculationService.clearPersistedMatrix();
    } else {
      // Try to load from localStorage first (draft)
      const draftTrip = this.loadDraftTrip(tripId);
      if (draftTrip) {
        this.updateState({
          trip: draftTrip,
          isLoading: false,
          isDirty: true,
          dataSource: 'draft',
        });
        // Clear matrix for draft trips - use local calculation
        this.matrixCalculationService.clearPersistedMatrix();
      } else {
        // Load from backend
        this.loadTripFromBackend(tripId).subscribe({
          next: trip => {
            this.updateState({
              trip,
              isLoading: false,
              isDirty: false,
              dataSource: 'persisted',
            });
            // Load persisted matrix for persisted trips
            this.loadPersistedMatrix(trip);
          },
          error: error => {
            console.error('TripDataService: Failed to load trip from backend:', error);
            this.updateState({
              isLoading: false,
              error: `Failed to load trip: ${error.message}`,
            });
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

    this.updateState({
      trip: updatedTrip,
      isDirty: true,
    });

    // Trigger auto-save for non-persisted trips
    if (this.dataSource() !== 'persisted') {
      this.autoSaveSubject.next(updatedTrip);
    }
  }

  /**
   * Add a location to the trip's banked locations
   */
  addLocationToBank(location: Location): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    // Create a new banked location entry
    const bankedLocation: TripBankedLocation = {
      id: crypto.randomUUID(),
      tripId: currentTrip.id,
      locationId: location.id,
      addedAt: new Date(),
      location,
    };

    // Check if location is already banked
    const existingBanked = currentTrip.bankedLocations.find(bl => bl.locationId === location.id);
    if (existingBanked) return;

    this.updateTripLocal({
      bankedLocations: [...currentTrip.bankedLocations, bankedLocation],
    });
  }

  /**
   * Remove a location from the trip's banked locations
   */
  removeLocationFromBank(locationId: string): void {
    const currentTrip = this.currentTrip();
    if (!currentTrip) return;

    this.updateTripLocal({
      bankedLocations: currentTrip.bankedLocations.filter(bl => bl.locationId !== locationId),
    });
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

      this.updateState({
        trip: { ...currentTrip, stops: optimisticStops },
        isOperationInProgress: true,
        error: null,
      });

      // Make backend call
      this.addStopToBackendTrip(location, insertAtIndex).subscribe({
        next: updatedTrip => {
          this.updateState({
            trip: updatedTrip,
            isDirty: false,
            isOperationInProgress: false,
          });
          // Load updated matrix for persisted trips after stop addition
          this.loadPersistedMatrix(updatedTrip);
        },
        error: error => {
          console.error('TripDataService: Failed to add stop to backend trip:', error);
          // Rollback optimistic update
          this.updateState({
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
      this.removeStopFromBackendTrip(stopId).subscribe({
        next: updatedTrip => {
          this.updateState({
            trip: updatedTrip,
            isDirty: false,
          });
        },
        error: error => {
          console.error('TripDataService: Failed to remove stop from backend trip:', error);
          this.updateState({
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

      this.reorderStopsInBackendTrip(stopOrders).subscribe({
        next: updatedTrip => {
          this.updateState({
            trip: updatedTrip,
            isDirty: false,
          });
        },
        error: error => {
          console.error('TripDataService: Failed to reorder stops in backend trip:', error);
          this.updateState({
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

    this.updateState({ isLoading: true, error: null });

    const isNewTrip = this.dataSource() === 'new';

    // For new trips with stops, use the itinerary endpoint for rich data persistence
    if (isNewTrip && currentTrip.stops.length > 0) {
      const organizedLocations = stopsToLocationForItinerary(currentTrip.stops);

      const apiCall = this.createTripWithItinerary(
        {
          name: currentTrip.name,
          description: currentTrip.description || undefined,
          startDate: currentTrip.startDate || undefined,
          endDate: currentTrip.endDate || undefined,
        },
        organizedLocations,
      );

      return apiCall.pipe(
        tap(savedTrip => {
          // Clear draft from localStorage
          this.clearDraftTrip(currentTrip.id);

          // Update state to reflect persisted trip
          this.updateState({
            trip: savedTrip,
            isLoading: false,
            isDirty: false,
            dataSource: 'persisted',
          });
        }),
        catchError((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.updateState({
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
        this.clearDraftTrip(currentTrip.id);

        // Update state to reflect persisted trip
        this.updateState({
          trip: savedTrip,
          isLoading: false,
          isDirty: false,
          dataSource: 'persisted',
        });
      }),
      catchError((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateState({
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
    this.updateState({
      trip: null,
      isLoading: false,
      isDirty: false,
      dataSource: 'new',
      error: null,
    });
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
   * Get stops with timing information for timeline views
   */
  getStopsWithTiming(): Stop[] {
    return this.sortedStops().filter(stop => stop.plannedArrivalTime || stop.calculatedArrivalTime);
  }

  /**
   * Calculate total planned duration for the trip
   */
  getTotalPlannedDuration(): number {
    return this.sortedStops().reduce((total, stop) => {
      return total + (stop.plannedDuration || 0);
    }, 0);
  }

  /**
   * Get the next stop in the timeline
   */
  getNextStop(currentStopId: string): Stop | null {
    const stops = this.sortedStops();
    const currentIndex = stops.findIndex(s => s.id === currentStopId);
    return currentIndex !== -1 && currentIndex < stops.length - 1 ? stops[currentIndex + 1] : null;
  }

  /**
   * Get the previous stop in the timeline
   */
  getPreviousStop(currentStopId: string): Stop | null {
    const stops = this.sortedStops();
    const currentIndex = stops.findIndex(s => s.id === currentStopId);
    return currentIndex > 0 ? stops[currentIndex - 1] : null;
  }

  /**
   * Backend API Integration Methods
   * These methods handle operations on persisted trips using the itinerary endpoints
   */

  /**
   * Create a trip with full itinerary data in the backend
   * @param tripData - Basic trip information
   * @param organizedLocations - Array of locations with order information
   * @returns Observable of created trip
   */
  createTripWithItinerary(
    tripData: { name: string; description?: string; startDate?: Date; endDate?: Date },
    organizedLocations: LocationForItinerary[],
  ): Observable<Trip> {
    const createRequest: CreateTripFromOrganizedListDto = {
      name: tripData.name,
      description: tripData.description || undefined,
      startDate: tripData.startDate?.toISOString(),
      endDate: tripData.endDate?.toISOString(),
      organizedLocations: organizedLocations,
      calculateRouting: true,
      travelMode: 'DRIVING',
    };

    return this.http.post<Trip>(`${this.apiUrl}/itinerary/trips`, createRequest);
  }

  /**
   * Add a stop to a persisted trip via backend API
   * @param location - Location to add as a stop
   * @param insertAtOrder - Optional order position to insert at
   * @returns Observable of updated trip
   */
  addStopToBackendTrip(location: Location, insertAtOrder?: number): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to add stop to');
    }

    const locationForItinerary = locationToLocationForItinerary(
      location,
      insertAtOrder ?? currentTrip.stops.length,
    );

    const addStopRequest: Omit<AddStopToTripDto, 'tripId'> = {
      locationData: locationForItinerary,
      insertAtOrder: insertAtOrder,
      calculateRouting: false,
      travelMode: 'DRIVING',
    };

    return this.http.post<Trip>(
      `${this.apiUrl}/itinerary/trips/${currentTrip.id}/stops`,
      addStopRequest,
    );
  }

  /**
   * Remove a stop from a persisted trip via backend API
   * @param stopId - ID of the stop to remove
   * @returns Observable of updated trip
   */
  removeStopFromBackendTrip(stopId: string): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to remove stop from');
    }

    const params = new HttpParams().set('calculateRouting', 'true').set('travelMode', 'DRIVING');

    return this.http.delete<Trip>(
      `${this.apiUrl}/itinerary/trips/${currentTrip.id}/stops/${stopId}`,
      { params },
    );
  }

  /**
   * Reorder stops in a persisted trip via backend API
   * @param stopOrders - Array of stop reordering instructions
   * @returns Observable of updated trip
   */
  reorderStopsInBackendTrip(
    stopOrders: Array<{ stopId: string; newOrder: number }>,
  ): Observable<Trip> {
    const currentTrip = this.currentTrip();
    if (!currentTrip) {
      throw new Error('No current trip to reorder stops in');
    }

    const reorderRequest: Omit<ItineraryReorderStopsDto, 'tripId'> = {
      stopOrders: stopOrders,
      calculateRouting: false,
      travelMode: 'DRIVING',
    };

    return this.http.put<Trip>(
      `${this.apiUrl}/itinerary/trips/${currentTrip.id}/stops/reorder`,
      reorderRequest,
    );
  }

  /**
   * Get localStorage key for draft trip
   */
  private getDraftKey(tripId: string): string {
    return `trip-draft-${tripId}`;
  }

  /**
   * Load draft trip from localStorage
   */
  private loadDraftTrip(tripId: string): Trip | null {
    return this.localStorage.get<Trip>(this.getDraftKey(tripId));
  }

  /**
   * Save draft trip to localStorage
   */
  private saveDraftTrip(trip: Trip): void {
    this.localStorage.set(this.getDraftKey(trip.id), trip);
  }

  /**
   * Clear draft trip from localStorage
   */
  private clearDraftTrip(tripId: string): void {
    this.localStorage.remove(this.getDraftKey(tripId));
  }

  /**
   * Initialize auto-save functionality
   */
  private initializeAutoSave(): void {
    this.autoSaveSubject
      .pipe(
        debounceTime(this.AUTO_SAVE_DEBOUNCE_TIME),
        distinctUntilChanged((a, b) => a.updatedAt.getTime() === b.updatedAt.getTime()),
      )
      .subscribe(trip => {
        this.saveDraftTrip(trip);
      });
  }

  /**
   * Update internal state
   */
  private updateState(updates: Partial<TripState>): void {
    this._state.update(current => ({ ...current, ...updates }));
  }

  /**
   * Load trip from backend
   */
  private loadTripFromBackend(tripId: string): Observable<Trip> {
    const params = new HttpParams()
      .set('includeStops', 'true')
      .set('includeBankedLocations', 'true')
      .set('includeTravelSegments', 'true');

    return this.http.get<Trip>(`${this.apiUrl}/trips/${tripId}`, { params });
  }

  /**
   * Create trip in backend
   */
  private createTripInBackend(trip: Trip): Observable<Trip> {
    const createRequest: CreateTripRequest = {
      name: trip.name,
      description: trip.description,
      startDate: trip.startDate,
      endDate: trip.endDate,
    };

    return this.http.post<Trip>(`${this.apiUrl}/trips`, createRequest);
  }

  /**
   * Update trip in backend
   */
  private updateTripInBackend(trip: Trip): Observable<Trip> {
    const updateRequest: UpdateTripWithRoutingRequest = {
      name: trip.name,
      description: trip.description,
      calculateRouting: true,
      travelMode: 'DRIVING',
      forceRecalculate: true,
    };

    return this.http.put<Trip>(`${this.apiUrl}/itinerary/trips/${trip.id}`, updateRequest);
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

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, tap, catchError, of, map } from 'rxjs';
import {
  Trip,
  Location,
  Stop,
  TripBankedLocation,
  CreateTripRequest,
  UpdateTripRequest,
  LocationForItinerary,
  CoordinateMatrix,
  TripSchema,
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
import { switchMap } from 'rxjs/operators';
import { TripTimezoneService } from './trip-timezone.service';

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
  private readonly tripTimezoneService = inject(TripTimezoneService);
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
      console.warn(
        'TripDataService: Missing calculated arrival/departure time for trip duration calculation.',
      );
      return null;
    }

    const start = new Date(firstStop.calculatedArrivalTime);
    const end = new Date(lastStop.calculatedDepartureTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error(
        'TripDataService: Invalid Date object encountered during trip duration calculation.',
        { start, end },
      );
      return null;
    }

    return end.getTime() - start.getTime(); // Duration in milliseconds
  });
  readonly hasScheduledStops = computed(() =>
    this.sortedStops().some(stop => !!stop.plannedArrivalTime),
  );
  readonly tripStartDate = computed(() => this.currentTrip()?.startDate || null);
  readonly tripEndDate = computed(() => this.currentTrip()?.endDate || null);

  // Timezone-aware computed properties (delegated to TripTimezoneService)
  readonly tripPrimaryTimezone = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.getTripPrimaryTimezone(trip);
  });

  readonly tripPrimaryTimezoneDisplayName = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.getTripPrimaryTimezoneDisplayName(trip);
  });

  readonly stopsWithTimezoneInfo = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.getStopsWithTimezoneInfo(trip);
  });

  readonly formattedTripStartDate = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.formatTripStartDate(trip);
  });

  readonly formattedTripEndDate = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.formatTripEndDate(trip);
  });

  readonly tripDurationInTimezone = computed(() => {
    const trip = this.currentTrip();
    return this.tripTimezoneService.calculateTripDurationInTimezone(trip);
  });

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
      // Update timezone service with the new trip
      this.tripTimezoneService.setCurrentTrip(newTrip);
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
        // Update timezone service with the draft trip
        this.tripTimezoneService.setCurrentTrip(draftTrip);
        // Clear matrix for draft trips - use local calculation
        this.matrixCalculationService.clearPersistedMatrix();
      } else {
        // Load from backend
        this.loadTripFromBackend(tripId).subscribe({
          next: trip => {
            // Use Zod to parse and coerce dates
            const parsedTrip = TripSchema.parse(trip);

            this.updateState({
              trip: parsedTrip,
              isLoading: false,
              isDirty: false,
              dataSource: 'persisted',
            });
            // Update timezone service with the persisted trip
            this.tripTimezoneService.setCurrentTrip(parsedTrip);
            // Load persisted matrix for persisted trips
            this.loadPersistedMatrix(parsedTrip);
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

    // Check if location is already banked
    const existingBanked = currentTrip.bankedLocations.find(bl => bl.locationId === location.id);
    if (existingBanked) return;

    // Check if this is a persisted trip that needs backend API calls
    if (this.dataSource() === 'persisted') {
      this.addLocationToBankApi(currentTrip.id, location).subscribe({
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
          this.updateState({
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
          this.setError('Failed to add location to bank');
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
      this.removeLocationFromBankApi(currentTrip.id, locationId).subscribe({
        next: () => {
          // Update local state by removing the location
          const updatedTrip = {
            ...currentTrip,
            bankedLocations: currentTrip.bankedLocations.filter(bl => bl.locationId !== locationId),
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
                console.warn('Failed to update matrix after removing banked location:', error);
              },
            });
        },
        error: (error: any) => {
          console.error('Failed to remove location from bank:', error);
          this.setError('Failed to remove location from bank');
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
            console.warn('Failed to update matrix after removing banked location:', error);
          },
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

      this.updateState({
        trip: { ...currentTrip, stops: optimisticStops },
        isOperationInProgress: true,
        error: null,
      });

      // Make backend call
      this.addStopToBackendTrip(location, insertAtIndex).subscribe({
        next: updatedTrip => {
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateState({
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
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateState({
            trip: parsedTrip,
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
          // Use Zod to parse and coerce dates
          const parsedTrip = TripSchema.parse(updatedTrip);
          this.updateState({
            trip: parsedTrip,
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

        // Use Zod to parse and coerce dates
        const parsedTrip = TripSchema.parse(savedTrip);

        // Update state to reflect persisted trip
        this.updateState({
          trip: parsedTrip,
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
    // Clear timezone service
    this.tripTimezoneService.setCurrentTrip(null);
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
      bankedLocations: [],
      calculateRouting: true,
      travelMode: 'DRIVING',
    };

    return this.http.post<Trip>(`${this.apiUrl}/itinerary/trips`, createRequest).pipe(
      map(response => TripSchema.parse(response))
    );
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
    ).pipe(
      map(response => TripSchema.parse(response))
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
    ).pipe(
      map(response => TripSchema.parse(response))
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
    ).pipe(
      map(response => TripSchema.parse(response))
    );
  }

  /**
   * Add a location to bank via backend API
   * @param tripId - ID of the trip
   * @param location - The location to add to bank
   * @returns Observable of created banked location
   */
  private addLocationToBankApi(tripId: string, location: Location): Observable<TripBankedLocation> {
    // We need to create location first to get its ID
    return this.http.post<Location>(`${this.apiUrl}/location`, location).pipe(
      // Then bank location
      switchMap((persistedLocation: Location) =>
        this.http.post<TripBankedLocation>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`, {
          locationId: persistedLocation.id,
        }),
      ),
    );
  }

  /**
   * Remove a location from bank via backend API
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to remove from bank
   * @returns Observable of void
   */
  private removeLocationFromBankApi(tripId: string, locationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}`);
  }

  /**
   * Get banked locations via backend API
   * @param tripId - ID of the trip
   * @returns Observable of banked locations
   */
  private getBankedLocationsApi(tripId: string): Observable<TripBankedLocation[]> {
    return this.http.get<TripBankedLocation[]>(`${this.apiUrl}/itinerary/trips/${tripId}/bank`);
  }

  /**
   * Promote a banked location to a stop via backend API
   * @param tripId - ID of the trip
   * @param locationId - ID of the location to promote
   * @param position - Optional position to insert stop at
   * @returns Observable of updated trip
   */
  private promoteLocationToStopApi(
    tripId: string,
    locationId: string,
    position?: number,
  ): Observable<Trip> {
    return this.http.post<Trip>(
      `${this.apiUrl}/itinerary/trips/${tripId}/bank/${locationId}/promote`,
      { locationId, position },
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
    const draft = this.localStorage.get<Trip>(this.getDraftKey(tripId));
    if (draft) {
      // Use Zod to parse and coerce dates from local storage
      return TripSchema.parse(draft);
    }
    return null;
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
   * Set error state
   */
  private setError(message: string): void {
    this.updateState({ error: message });
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

    return this.http.get<Trip>(`${this.apiUrl}/trips/${tripId}`, { params }).pipe(
      map(response => TripSchema.parse(response))
    );
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

    return this.http.post<Trip>(`${this.apiUrl}/trips`, createRequest).pipe(
      map(response => TripSchema.parse(response))
    );
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

    return this.http.put<Trip>(`${this.apiUrl}/itinerary/trips/${trip.id}`, updateRequest).pipe(
      map(response => TripSchema.parse(response))
    );
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

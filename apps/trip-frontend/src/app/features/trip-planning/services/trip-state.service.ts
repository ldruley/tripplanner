import { Injectable, inject, signal, computed } from '@angular/core';
import { Trip, Stop } from '@trip-planner/types';
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

/**
 * TripStateService
 * 
 * Centralized state management for trip data using Angular signals.
 * Provides reactive state updates and computed properties for trip-related data.
 */
@Injectable({
  providedIn: 'root',
})
export class TripStateService {
  private readonly tripTimezoneService = inject(TripTimezoneService);

  // Internal state signal
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
        'TripStateService: Missing calculated arrival/departure time for trip duration calculation.',
      );
      return null;
    }

    const start = new Date(firstStop.calculatedArrivalTime);
    const end = new Date(lastStop.calculatedDepartureTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error(
        'TripStateService: Invalid Date object encountered during trip duration calculation.',
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

  /**
   * Update the internal state
   * @param updates - Partial state updates to apply
   */
  updateState(updates: Partial<TripState>): void {
    this._state.update(current => ({ ...current, ...updates }));
  }

  /**
   * Set the current trip and update timezone service
   * @param trip - Trip to set as current
   * @param dataSource - Source of the trip data
   * @param isDirty - Whether the trip has unsaved changes
   */
  setTrip(trip: Trip | null, dataSource: DataSource = 'new', isDirty = false): void {
    this.updateState({
      trip,
      dataSource,
      isDirty,
      error: null,
    });

    // Update timezone service with the new trip
    this.tripTimezoneService.setCurrentTrip(trip);
  }

  /**
   * Update the current trip with partial updates
   * @param updates - Partial trip updates to apply
   */
  updateTrip(updates: Partial<Trip>): void {
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
  }

  /**
   * Set loading state
   * @param isLoading - Whether loading is in progress
   */
  setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  /**
   * Set error state
   * @param error - Error message or null to clear
   */
  setError(error: string | null): void {
    this.updateState({ error });
  }

  /**
   * Set operation in progress state
   * @param isOperationInProgress - Whether an operation is in progress
   */
  setOperationInProgress(isOperationInProgress: boolean): void {
    this.updateState({ isOperationInProgress });
  }

  /**
   * Clear all state and reset to initial values
   */
  clearState(): void {
    this.updateState({
      trip: null,
      isLoading: false,
      isDirty: false,
      dataSource: 'new',
      error: null,
      isOperationInProgress: false,
    });
    
    // Clear timezone service
    this.tripTimezoneService.setCurrentTrip(null);
  }

  /**
   * Get stops with timing information for timeline views
   * @returns Array of stops that have timing information
   */
  getStopsWithTiming(): Stop[] {
    return this.sortedStops().filter(stop => stop.plannedArrivalTime || stop.calculatedArrivalTime);
  }

  /**
   * Calculate total planned duration for the trip
   * @returns Total planned duration in milliseconds
   */
  getTotalPlannedDuration(): number {
    return this.sortedStops().reduce((total, stop) => {
      return total + (stop.plannedDuration || 0);
    }, 0);
  }

  /**
   * Get the next stop in the timeline
   * @param currentStopId - ID of the current stop
   * @returns Next stop or null if none exists
   */
  getNextStop(currentStopId: string): Stop | null {
    const stops = this.sortedStops();
    const currentIndex = stops.findIndex(s => s.id === currentStopId);
    return currentIndex !== -1 && currentIndex < stops.length - 1 ? stops[currentIndex + 1] : null;
  }

  /**
   * Get the previous stop in the timeline
   * @param currentStopId - ID of the current stop
   * @returns Previous stop or null if none exists
   */
  getPreviousStop(currentStopId: string): Stop | null {
    const stops = this.sortedStops();
    const currentIndex = stops.findIndex(s => s.id === currentStopId);
    return currentIndex > 0 ? stops[currentIndex - 1] : null;
  }
}
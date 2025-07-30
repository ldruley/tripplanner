import { Injectable, inject, computed } from '@angular/core';
import { Observable, switchMap, tap, of, catchError } from 'rxjs';
import {
  Trip,
  Stop,
  Location,
  LocationForItinerary,
  TripBankedLocation,
  UpdateTripWithRoutingRequest,
} from '@trip-planner/types';

// Command and Query imports
import { TripCommandService } from './services/trip-command.service';
import { TripQueryService } from './services/trip-query.service';
import { TripStateService } from './state/trip-state.service';
import { TripStateMachine } from './state-machine/trip-state.machine';
import { MatrixEventService } from './services/matrix-event.service';
import { MatrixCalculationService } from '../../features/trip-planning/services/matrix-calculation.service';

// Command types
import {
  CreateTripCommand,
  UpdateTripCommand,
  DeleteTripCommand,
  AddStopCommand,
  RemoveStopCommand,
  UpdateStopCommand,
  AddBankedLocationCommand,
  RemoveBankedLocationCommand,
  CreateTripWithItineraryCommand,
  ReorderStopsCommand,
  PromoteBankedLocationToStopCommand,
  UpdateTripWithRoutingCommand,
} from './commands/trip-commands';

// Query types
import {
  GetAllTripsQuery,
  GetTripByIdQuery,
  GetTripCountQuery,
  GetTripWithRelationsQuery,
  GetBankedLocationsQuery,
} from './queries/trip-queries';

// State machine types
import { TripStatus, TripStateMachineEvent } from './state-machine/trip-states';

/**
 * TripFacade
 *
 * Unified domain facade that provides a clean, simplified API for feature modules
 * to interact with the trip domain, abstracting away the underlying CQRS and
 * state machine complexity.
 *
 * This service orchestrates calls to TripCommandService, TripQueryService,
 * TripStateService, and TripStateMachine to provide high-level, use-case-driven
 * methods for trip management.
 */
@Injectable({
  providedIn: 'root',
})
export class TripFacade {
  private readonly commandService = inject(TripCommandService);
  private readonly queryService = inject(TripQueryService);
  private readonly stateService = inject(TripStateService);
  private readonly stateMachine = inject(TripStateMachine);
  private readonly matrixCalculationService = inject(MatrixCalculationService);

  // Expose reactive state for UI binding
  readonly currentTrip = this.stateService.currentTrip;
  readonly isLoading = this.stateService.isLoading;
  readonly isDirty = this.stateService.isDirty;
  readonly error = this.stateService.error;
  readonly dataSource = this.stateService.dataSource;
  readonly isOperationInProgress = this.stateService.isOperationInProgress;

  // Trip-specific computed properties
  readonly hasTrip = this.stateService.hasTrip;
  readonly tripId = this.stateService.tripId;
  readonly tripName = this.stateService.tripName;
  readonly tripDescription = this.stateService.tripDescription;
  readonly itineraryStops = this.stateService.itineraryStops;
  readonly bankedLocations = this.stateService.bankedLocations;
  readonly travelSegments = this.stateService.travelSegments;

  // State machine properties
  readonly tripStatus = this.stateService.tripStatus;
  readonly isDraftTrip = this.stateService.isDraftTrip;
  readonly isPersistedTrip = this.stateService.isPersistedTrip;
  readonly isStateMachineTransitioning = this.stateService.isStateMachineTransitioning;
  readonly availableStateTransitions = this.stateService.availableStateTransitions;

  // Timeline-specific properties
  readonly sortedStops = this.stateService.sortedStops;
  readonly tripDuration = this.stateService.tripDuration;
  readonly hasScheduledStops = this.stateService.hasScheduledStops;
  readonly tripStartDate = this.stateService.tripStartDate;
  readonly tripEndDate = this.stateService.tripEndDate;

  // Timezone-aware properties
  readonly tripPrimaryTimezone = this.stateService.tripPrimaryTimezone;
  readonly tripPrimaryTimezoneDisplayName = this.stateService.tripPrimaryTimezoneDisplayName;
  readonly stopsWithTimezoneInfo = this.stateService.stopsWithTimezoneInfo;
  readonly formattedTripStartDate = this.stateService.formattedTripStartDate;
  readonly formattedTripEndDate = this.stateService.formattedTripEndDate;
  readonly tripDurationInTimezone = this.stateService.tripDurationInTimezone;

  // =============================================================================
  // COMMAND OPERATIONS (Write Operations)
  // =============================================================================

  /**
   * Create a new trip
   */
  createTrip(name: string, description?: string): Observable<{ tripId: string }> {
    const command: CreateTripCommand = {
      type: '[Trip] Create Trip',
      payload: { name, description },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Update trip details
   */
  updateTripDetails(tripId: string, updates: Partial<Trip>): Observable<void> {
    const command: UpdateTripCommand = {
      type: '[Trip] Update Trip',
      payload: { tripId, updates },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Update trip locally (for draft trips that need immediate local updates)
   */
  updateTripLocally(updates: Partial<Trip>): void {
    this.stateService.updateTrip(updates);
  }

  /**
   * Delete a trip
   */
  deleteTrip(tripId: string): Observable<void> {
    const command: DeleteTripCommand = {
      type: '[Trip] Delete Trip',
      payload: { tripId },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Add a stop to the current trip's itinerary
   */
  addStop(tripId: string, location: Location, insertAtIndex?: number): Observable<void> {
    const command: AddStopCommand = {
      type: '[Stop] Add Stop',
      payload: { tripId, location, insertAtIndex },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Remove a stop from the current trip's itinerary
   */
  removeStop(tripId: string, stopId: string): Observable<void> {
    const command: RemoveStopCommand = {
      type: '[Stop] Remove Stop',
      payload: { tripId, stopId },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Update a stop in the current trip's itinerary
   */
  updateStop(tripId: string, stopId: string, updates: Partial<Stop>): Observable<void> {
    const command: UpdateStopCommand = {
      type: '[Stop] Update Stop',
      payload: { tripId, stopId, updates },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Add a location to the trip's banked locations
   */
  addBankedLocation(tripId: string, location: Location): Observable<void> {
    const command: AddBankedLocationCommand = {
      type: '[BankedLocation] Add Banked Location',
      payload: { tripId, location },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Remove a location from the trip's banked locations
   */
  removeBankedLocation(tripId: string, locationId: string): Observable<void> {
    const command: RemoveBankedLocationCommand = {
      type: '[BankedLocation] Remove Banked Location',
      payload: { tripId, locationId },
    };
    return this.commandService.dispatch(command);
  }

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
  ): Observable<{ tripId: string }> {
    const command: CreateTripWithItineraryCommand = {
      type: '[Trip] Create Trip With Itinerary',
      payload: { tripData, organizedLocations },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Reorder stops in a trip's itinerary
   */
  reorderStops(
    tripId: string,
    stopOrders: Array<{ stopId: string; newOrder: number }>,
  ): Observable<void> {
    const command: ReorderStopsCommand = {
      type: '[Stop] Reorder Stops',
      payload: { tripId, stopOrders },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Promote a banked location to a stop
   */
  promoteBankedLocationToStop(
    tripId: string,
    locationId: string,
    position?: number,
  ): Observable<void> {
    const command: PromoteBankedLocationToStopCommand = {
      type: '[BankedLocation] Promote To Stop',
      payload: { tripId, locationId, position },
    };
    return this.commandService.dispatch(command);
  }

  /**
   * Update trip with routing calculations
   */
  updateTripWithRouting(
    tripId: string,
    updateData: UpdateTripWithRoutingRequest,
  ): Observable<void> {
    const command: UpdateTripWithRoutingCommand = {
      type: '[Trip] Update Trip With Routing',
      payload: { tripId, updateData },
    };
    return this.commandService.dispatch(command);
  }

  // =============================================================================
  // QUERY OPERATIONS (Read Operations)
  // =============================================================================

  /**
   * Get all trips for the current user
   */
  getAllTrips(): Observable<Trip[]> {
    const query: GetAllTripsQuery = {
      type: '[Trip] Get All Trips',
    };
    return this.queryService.execute(query);
  }

  /**
   * Get detailed information for a specific trip
   */
  getTripDetails(
    tripId: string,
    includeStops = false,
    includeTravelSegments = false,
    includeBankedLocations = false,
  ): Observable<Trip | null> {
    const query: GetTripByIdQuery = {
      type: '[Trip] Get Trip By Id',
      payload: { tripId, includeStops, includeBankedLocations, includeTravelSegments },
    };
    return this.queryService.execute(query);
  }

  /**
   * Get the total number of trips for the current user
   */
  getTripCount(): Observable<{ count: number }> {
    const query: GetTripCountQuery = {
      type: '[Trip] Get Trip Count',
    };
    return this.queryService.execute(query);
  }

  /**
   * Get a trip with all relations (stops, banked locations, travel segments)
   */
  getTripWithRelations(tripId: string): Observable<Trip | null> {
    const query: GetTripWithRelationsQuery = {
      type: '[Trip] Get Trip With Relations',
      payload: { tripId },
    };
    return this.queryService.execute(query);
  }

  /**
   * Get banked locations for a specific trip
   */
  getBankedLocations(tripId: string): Observable<TripBankedLocation[]> {
    const query: GetBankedLocationsQuery = {
      type: '[Trip] Get Banked Locations',
      payload: { tripId },
    };
    return this.queryService.execute(query);
  }

  // =============================================================================
  // STATE MACHINE OPERATIONS
  // =============================================================================

  /**
   * Check if a state transition is valid for the current trip
   */
  canTransitionTrip(event: TripStateMachineEvent): boolean {
    return this.stateMachine.canTransition(event);
  }

  /**
   * Perform a state transition for the current trip
   */
  transitionTrip(event: TripStateMachineEvent, tripId?: string): void {
    this.stateMachine.transition(event, tripId);
  }

  /**
   * Get the valid transitions available for the current trip state
   */
  getValidTransitions(): TripStateMachineEvent[] {
    return this.stateMachine.validTransitions();
  }

  // =============================================================================
  // HIGH-LEVEL USE CASE METHODS
  // =============================================================================

  /**
   * Load a trip and set it as the current working trip
   * This method handles both loading the trip data and setting up the state machine
   */
  loadTrip(tripId: string): Observable<Trip | null> {
    return this.getTripDetails(tripId, true, true, true).pipe(
      tap(trip => {
        if (trip) {
          this.stateService.setTrip(trip, 'persisted', false);
          this.stateMachine.initializeState('persisted', trip.id);

          // Deserialize and set persisted matrix data if available
          if (trip.matrix) {
            try {
              console.log('TripFacade: Deserializing persisted matrix data for trip:', trip.id);
              const deserializedMatrix = this.matrixCalculationService.deserializeMatrix(trip.matrix);
              this.matrixCalculationService.setPersistedMatrix(deserializedMatrix);
            } catch (error) {
              console.warn('TripFacade: Failed to deserialize matrix data:', error);
              // Continue without matrix data rather than failing the entire load
            }
          } else {
            console.log('TripFacade: No matrix data found for trip:', trip.id);
            this.matrixCalculationService.setPersistedMatrix(null);
          }
        } else {
          this.stateService.clearState();
        }
      }),
      catchError(error => {
        console.error('Failed to load trip:', error);
        this.stateService.setError('Failed to load trip. Please try again.');
        return of(null);
      }),
    );
  }

  /**
   * Create a new trip and set it as the current working trip
   */
  createAndLoadTrip(name: string, description?: string): Observable<Trip | null> {
    return this.createTrip(name, description).pipe(
      switchMap(result => this.loadTrip(result.tripId)),
      catchError(error => {
        console.error('Failed to create and load trip:', error);
        this.stateService.setError('Failed to create trip. Please try again.');
        return of(null);
      }),
    );
  }

  /**
   * Start a new draft trip (local only)
   */
  startNewDraftTrip(name: string, description?: string): void {
    // Create a new trip object for draft state
    const draftTrip: Trip = {
      id: `draft-${Date.now()}`, // Temporary ID for draft
      name,
      description: description || '',
      startDate: null,
      endDate: null,
      stops: [],
      bankedLocations: [],
      travelSegments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '', // Will be set when persisted
      needsRoutingRecalculation: false,
      needsTimelineRecalculation: false,
    };

    this.stateService.setTrip(draftTrip, 'draft', true);
    this.stateMachine.initializeState('draft', draftTrip.id);
  }

  /**
   * Clear the current trip state and reset everything
   */
  clearCurrentTrip(): void {
    this.stateService.clearState();
    this.stateMachine.reset();
  }

  /**
   * Refresh the current trip data from the server
   */
  refreshCurrentTrip(): Observable<Trip | null> {
    const currentTripId = this.tripId();
    if (!currentTripId) {
      return of(null);
    }

    // Only refresh if it's a persisted trip
    if (this.isPersistedTrip()) {
      return this.loadTrip(currentTripId);
    }

    return of(this.currentTrip());
  }

  // =============================================================================
  // CONVENIENCE METHODS (Delegated to TripStateService)
  // =============================================================================

  /**
   * Get stops with timing information for timeline views
   */
  getStopsWithTiming(): Stop[] {
    return this.stateService.getStopsWithTiming();
  }

  /**
   * Calculate total planned duration for the trip
   */
  getTotalPlannedDuration(): number {
    return this.stateService.getTotalPlannedDuration();
  }

  /**
   * Get the next stop in the timeline
   */
  getNextStop(currentStopId: string): Stop | null {
    return this.stateService.getNextStop(currentStopId);
  }

  /**
   * Get the previous stop in the timeline
   */
  getPreviousStop(currentStopId: string): Stop | null {
    return this.stateService.getPreviousStop(currentStopId);
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  /**
   * Invalidate query caches (useful for forcing refresh)
   */
  invalidateCache(tripId?: string): void {
    this.queryService.invalidateCache(tripId);
  }
}

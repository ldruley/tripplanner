import { Injectable, inject, OnDestroy } from '@angular/core';
import { debounceTime, takeUntil, Subject, switchMap, catchError, of, Observable, tap, map } from 'rxjs';
import { TripEventBus } from '../events/trip-event.bus';
import {
  StopAddedEvent,
  StopRemovedEvent,
  BankedLocationAddedEvent,
  BankedLocationRemovedEvent,
  MatrixUpdateRequestedEvent,
  MatrixUpdatedEvent
} from '../events/trip-events';
import { TripFacade } from '../trip.facade';
import { MatrixCalculationService } from '../../../features/trip-planning/services/matrix-calculation.service';
import { Location } from '@trip-planner/types';
import { CoordinateMatrix } from '@trip-planner/types';

/**
 * MatrixEventService
 *
 * Event-driven service that automatically updates travel matrices when trip
 * locations change. Listens to stop and banked location events and triggers
 * matrix recalculations with debouncing to prevent excessive API calls.
 */
@Injectable({
  providedIn: 'root'
})
export class MatrixEventService implements OnDestroy {
  private readonly tripEventBus = inject(TripEventBus);
  private readonly tripFacade = inject(TripFacade);
  private readonly matrixCalculationService = inject(MatrixCalculationService);

  private readonly destroy$ = new Subject<void>();
  private readonly DEBOUNCE_TIME = 500; // 500ms debounce to prevent excessive calculations

  constructor() {
    console.log('MatrixEventService: Constructor called, setting up event listeners');
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Set up event listeners for trip location changes
   */
  private setupEventListeners(): void {
    console.log('MatrixEventService: Setting up event listeners');

    // Listen to stop events
    console.log('MatrixEventService: Setting up [Stop] Added listener');
    this.tripEventBus.on<StopAddedEvent>('[Stop] Added')
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(payload => {
        console.log('MatrixEventService: Stop added, requesting matrix update for trip:', payload.tripId);
        this.requestMatrixUpdate(payload.tripId);
      });

    this.tripEventBus.on<StopRemovedEvent>('[Stop] Removed')
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(payload => {
        console.log('MatrixEventService: Stop removed, requesting matrix update for trip:', payload.tripId);
        this.requestMatrixUpdate(payload.tripId);
      });

    // Listen to banked location events
    console.log('MatrixEventService: Setting up [BankedLocation] Added listener');
    this.tripEventBus.on<BankedLocationAddedEvent>('[BankedLocation] Added')
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(payload => {
        console.log('MatrixEventService: Banked location added, requesting matrix update for trip:', payload.tripId);
        this.requestMatrixUpdate(payload.tripId);
      });

    this.tripEventBus.on<BankedLocationRemovedEvent>('[BankedLocation] Removed')
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        takeUntil(this.destroy$)
      )
      .subscribe(payload => {
        console.log('MatrixEventService: Banked location removed, requesting matrix update for trip:', payload.tripId);
        this.requestMatrixUpdate(payload.tripId);
      });

    // Listen to explicit matrix update requests
    this.tripEventBus.on<MatrixUpdateRequestedEvent>('[Trip] Matrix Update Requested')
      .pipe(
        debounceTime(this.DEBOUNCE_TIME),
        switchMap(payload => this.calculateMatrixForLocations(payload.tripId, payload.locations)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        error: (error) => console.error('MatrixEventService: Error in matrix update listener:', error)
      });
  }

  /**
   * Request a matrix update for a specific trip
   * Gets the current trip data and triggers matrix calculation
   */
  private requestMatrixUpdate(tripId: string): void {
    const currentTrip = this.tripFacade.currentTrip();

    console.log('MatrixEventService: Matrix update requested for tripId:', tripId);
    console.log('MatrixEventService: Current trip:', currentTrip ? { id: currentTrip.id, state: (currentTrip as any).state } : 'null');
    console.log('MatrixEventService: Is mobile device:', window.innerWidth < 768);

    // Only update if this is the currently active trip
    if (!currentTrip || currentTrip.id !== tripId) {
      console.log('MatrixEventService: Ignoring matrix update request for inactive trip:', tripId, 'Current trip ID:', currentTrip?.id);
      return;
    }

    // Collect all locations (stops + banked locations)
    const allLocations: Location[] = [
      // Locations from stops
      ...currentTrip.stops
        .map(stop => stop.location)
        .filter((location): location is Location => !!location),

      // Locations from banked locations
      ...currentTrip.bankedLocations
        .map(bankedLocation => bankedLocation.location)
        .filter((location): location is Location => !!location)
    ];

    // Only calculate if we have enough locations
    if (allLocations.length < 2) {
      console.log('MatrixEventService: Not enough locations for matrix calculation:', allLocations.length);
      // Clear existing matrix if we don't have enough locations
      this.tripFacade.updateTripLocally({ matrix: null });
      return;
    }

    console.log('MatrixEventService: Publishing matrix update requested event for tripId:', tripId, 'with', allLocations.length, 'locations');

    // Emit matrix update requested event
    this.tripEventBus.publish<MatrixUpdateRequestedEvent>({
      type: '[Trip] Matrix Update Requested',
      payload: { tripId, locations: allLocations }
    });
  }

  /**
   * Calculate matrix for specific locations and update trip
   */
  private calculateMatrixForLocations(tripId: string, locations: Location[]): Observable<void> {
    console.log('MatrixEventService: Calculating matrix for', locations.length, 'locations');

    return this.matrixCalculationService.calculateMatrix(locations)
      .pipe(
        catchError(error => {
          console.warn('MatrixEventService: Matrix calculation failed:', error);
          return of(null);
        }),
        tap(matrix => {
          if (matrix) {
            // Update trip with new matrix data
            this.tripFacade.updateTripLocally({
              matrix: this.matrixCalculationService.serializeMatrix(matrix)
            });

            // Emit matrix updated event
            this.tripEventBus.publish<MatrixUpdatedEvent>({
              type: '[Trip] Matrix Updated',
              payload: { tripId, matrix }
            });

            console.log('MatrixEventService: Matrix successfully updated for trip:', tripId);
          }
        }),
        map(() => void 0) // Return void
      );
  }

  /**
   * Manually trigger a matrix update for the current trip
   * Useful for forcing a recalculation
   */
  public triggerMatrixUpdate(): void {
    const currentTrip = this.tripFacade.currentTrip();
    if (currentTrip) {
      this.requestMatrixUpdate(currentTrip.id);
    }
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, of, from, throwError } from 'rxjs';
import { switchMap, catchError, shareReplay, tap, map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { TripStateService } from '../state/trip-state.service';
import { TripEventBus } from '../events/trip-event.bus';
import { TripStateMachine } from '../state-machine/trip-state.machine';
import { Query, GetAllTripsQuery, GetTripByIdQuery, GetTripCountQuery } from '../queries/trip-queries';
import { TripCreatedEvent, TripUpdatedEvent, TripDeletedEvent } from '../events/trip-events';
import { Trip, TripSchema } from '@trip-planner/types';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TripQueryService {
  private readonly http = inject(HttpClient);
  private readonly tripStateService = inject(TripStateService);
  private readonly tripEventBus = inject(TripEventBus);
  private readonly tripStateMachine = inject(TripStateMachine);
  private readonly apiUrl = environment.backendApiUrl;

  // Simple in-memory cache for trips
  private tripCache = new Map<string, Observable<Trip | null>>();
  private allTripsCache$: Observable<Trip[]> | null = null;
  private tripCountCache$: Observable<{ count: number }> | null = null;

  constructor() {
    // Set up cache invalidation listeners
    this.setupCacheInvalidation();
  }

  /**
   * Execute a query and return the result
   */
  execute<TResult>(query: Query<TResult>): Observable<TResult> {
    switch (query.type) {
      case '[Trip] Get All Trips':
        return this.executeGetAllTrips() as Observable<TResult>;

      case '[Trip] Get Trip By Id':
        const getByIdQuery = query as GetTripByIdQuery;
        return this.executeGetTripById(
          getByIdQuery.payload.tripId,
          getByIdQuery.payload.includeStops,
          getByIdQuery.payload.includeBankedLocations
        ) as Observable<TResult>;

      case '[Trip] Get Trip Count':
        return this.executeGetTripCount() as Observable<TResult>;

      default:
        return throwError(() => new Error(`Unknown query type: ${query.type}`));
    }
  }

  /**
   * Invalidate cache entries
   */
  invalidateCache(tripId?: string): void {
    if (tripId) {
      // Invalidate specific trip entries
      this.tripCache.forEach((_obs, key) => {
        if (key.startsWith(tripId)) {
          this.tripCache.delete(key);
        }
      });
    } else {
      // Invalidate all caches
      this.tripCache.clear();
    }
    
    // Always invalidate aggregate caches when any trip changes
    this.allTripsCache$ = null;
    this.tripCountCache$ = null;
  }

  /**
   * Execute get all trips query with caching
   */
  private executeGetAllTrips(): Observable<Trip[]> {
    if (!this.allTripsCache$) {
      this.allTripsCache$ = this.http
        .get<Trip[]>(`${this.apiUrl}/trips`)
        .pipe(
          map(response => response.map(trip => TripSchema.parse(trip))),
          shareReplay(1),
          catchError(error => {
            console.error('Error fetching all trips:', error);
            this.allTripsCache$ = null; // Reset cache on error
            return of([]); // Return empty array on error
          })
        );
    }
    return this.allTripsCache$;
  }

  /**
   * Execute get trip by ID query with caching
   */
  private executeGetTripById(
    tripId: string, 
    includeStops = false, 
    includeBankedLocations = false
  ): Observable<Trip | null> {
    // Check if the requested trip is the current in-memory trip
    const currentTrip = this.tripStateService.currentTrip();
    const currentState = this.tripStateMachine.currentState();
    
    // If we have a current trip and it matches the requested ID
    if (currentTrip && currentTrip.id === tripId) {
      // For draft trips, always return from memory
      if (currentState === 'draft') {
        return of(currentTrip);
      }
      // For persisted trips, we can still return from memory if it's the active trip
      return of(currentTrip);
    }

    // Check cache
    const cacheKey = `${tripId}-${includeStops}-${includeBankedLocations}`;
    if (this.tripCache.has(cacheKey)) {
      return this.tripCache.get(cacheKey)!;
    }

    // Create new observable and cache it
    const params = new URLSearchParams();
    if (includeStops) params.append('includeStops', 'true');
    if (includeBankedLocations) params.append('includeBankedLocations', 'true');

    const queryString = params.toString();
    const url = queryString
      ? `${this.apiUrl}/trips/${tripId}?${queryString}`
      : `${this.apiUrl}/trips/${tripId}`;

    const tripObservable = this.http.get<Trip>(url).pipe(
      map(response => TripSchema.parse(response)),
      tap(trip => {
        if (trip) {
          // Update current trip in state if this is the active trip
          const currentTripId = this.tripStateService.currentTrip()?.id;
          if (currentTripId === tripId) {
            this.tripStateService.setTrip(trip, 'persisted', false);
            // Initialize state machine for loaded persisted trip
            this.tripStateMachine.initializeState('persisted', trip.id);
          }
        }
      }),
      shareReplay(1),
      catchError(error => {
        console.error(`Error fetching trip ${tripId}:`, error);
        this.tripCache.delete(cacheKey); // Remove from cache on error
        return of(null); // Return null on error
      })
    );

    this.tripCache.set(cacheKey, tripObservable);
    return tripObservable;
  }

  /**
   * Execute get trip count query with caching
   */
  private executeGetTripCount(): Observable<{ count: number }> {
    if (!this.tripCountCache$) {
      this.tripCountCache$ = this.http.get<{ count: number }>(`${this.apiUrl}/trips/user/count`).pipe(
        shareReplay(1),
        catchError(error => {
          console.error('Error fetching trip count:', error);
          this.tripCountCache$ = null; // Reset cache on error
          return of({ count: 0 }); // Return zero count on error
        })
      );
    }
    return this.tripCountCache$;
  }

  /**
   * Set up event listeners for cache invalidation
   */
  private setupCacheInvalidation(): void {
    // Invalidate all caches when trips are created or deleted
    this.tripEventBus.on<TripCreatedEvent>('[Trip] Created').subscribe(() => {
      this.invalidateCache();
    });

    this.tripEventBus.on<TripDeletedEvent>('[Trip] Deleted').subscribe(payload => {
      this.invalidateCache(payload.tripId);
    });

    // Invalidate specific trip cache when updated
    this.tripEventBus.on<TripUpdatedEvent>('[Trip] Updated').subscribe(payload => {
      this.invalidateCache(payload.tripId);
    });
  }
}
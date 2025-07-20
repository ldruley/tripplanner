import { Injectable, inject } from '@angular/core';
import { debounceTime, distinctUntilChanged, switchMap, filter, take } from 'rxjs/operators';
import { TripEventBus } from '../events/trip-event.bus';
import { TripUpdatedEvent, TripSavedEvent } from '../events/trip-events';
import { TripDraftRepository } from '../repositories/trip-draft.repository';
import { TripStateService } from '../state/trip-state.service';

/**
 * TripAutoSaveService
 * 
 * Event-driven auto-save service that listens to trip update events
 * and automatically saves drafts to localStorage with debouncing.
 */
@Injectable({
  providedIn: 'root'
})
export class TripAutoSaveService {
  private readonly tripEventBus = inject(TripEventBus);
  private readonly tripDraftRepository = inject(TripDraftRepository);
  private readonly tripStateService = inject(TripStateService);

  private readonly AUTO_SAVE_DEBOUNCE_TIME = 5000; // 5 seconds

  constructor() {
    this.initializeAutoSave();
  }

  /**
   * Initialize event-driven auto-save functionality
   */
  private initializeAutoSave(): void {
    this.tripEventBus
      .on<TripUpdatedEvent>('[Trip] Updated')
      .pipe(
        debounceTime(this.AUTO_SAVE_DEBOUNCE_TIME),
        distinctUntilChanged((prev, curr) => 
          prev.tripId === curr.tripId && 
          prev.updates.updatedAt?.getTime() === curr.updates.updatedAt?.getTime()
        ),
        // Get the current full trip from state service
        switchMap(payload => {
          const currentTrip = this.tripStateService.currentTrip();
          return currentTrip ? [currentTrip] : [];
        }),
        filter(trip => !!trip) // Ensure trip exists
      )
      .subscribe(trip => {
        if (trip) {
          // Only auto-save for non-persisted trips (new/draft)
          const dataSource = this.tripStateService.dataSource();
          if (dataSource !== 'persisted') {
            this.tripDraftRepository.saveDraft(trip);
            
            // Publish save event for user feedback
            this.tripEventBus.publish<TripSavedEvent>({
              type: '[Trip] Saved',
              payload: { 
                tripId: trip.id, 
                saveType: 'auto' 
              }
            });
          }
        }
      });
  }
}
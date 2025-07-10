import { Injectable, inject } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { Trip, TripSchema } from '@trip-planner/types';
import { LocalStorageService } from '../../../core/services/local-storage.service';

/**
 * TripDraftStore
 * 
 * Encapsulates draft storage and loading logic for trips.
 * Handles auto-save functionality with debouncing and localStorage operations.
 */
@Injectable({
  providedIn: 'root',
})
export class TripDraftStore {
  private readonly localStorage = inject(LocalStorageService);
  
  // Auto-save configuration
  private readonly autoSaveSubject = new Subject<Trip>();
  private readonly AUTO_SAVE_DEBOUNCE_TIME = 5000; // 5 seconds

  constructor() {
    this.initializeAutoSave();
  }

  /**
   * Load draft trip from localStorage
   * @param tripId - ID of the trip to load
   * @returns Trip if found, null otherwise
   */
  loadDraft(tripId: string): Trip | null {
    const draft = this.localStorage.get<Trip>(this.getDraftKey(tripId));
    if (draft) {
      // Use Zod to parse and coerce dates from local storage
      return TripSchema.parse(draft);
    }
    return null;
  }

  /**
   * Save draft trip to localStorage immediately
   * @param trip - Trip to save as draft
   */
  saveDraft(trip: Trip): void {
    this.localStorage.set(this.getDraftKey(trip.id), trip);
  }

  /**
   * Clear draft trip from localStorage
   * @param tripId - ID of the trip draft to clear
   */
  clearDraft(tripId: string): void {
    this.localStorage.remove(this.getDraftKey(tripId));
  }

  /**
   * Schedule auto-save for a trip (debounced)
   * @param trip - Trip to auto-save
   */
  scheduleAutoSave(trip: Trip): void {
    this.autoSaveSubject.next(trip);
  }

  /**
   * Check if a draft exists for a trip
   * @param tripId - ID of the trip to check
   * @returns true if draft exists, false otherwise
   */
  hasDraft(tripId: string): boolean {
    return this.localStorage.get<Trip>(this.getDraftKey(tripId)) !== null;
  }

  /**
   * Get all draft trip IDs
   * @returns Array of trip IDs that have drafts
   */
  getAllDraftIds(): string[] {
    const draftKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('trip-draft-')) {
        draftKeys.push(key);
      }
    }
    return draftKeys.map(key => key.replace('trip-draft-', ''));
  }

  /**
   * Clear all draft trips
   */
  clearAllDrafts(): void {
    const draftKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('trip-draft-')) {
        draftKeys.push(key);
      }
    }
    draftKeys.forEach(key => this.localStorage.remove(key));
  }

  /**
   * Get localStorage key for draft trip
   * @param tripId - ID of the trip
   * @returns localStorage key for the draft
   */
  private getDraftKey(tripId: string): string {
    return `trip-draft-${tripId}`;
  }

  /**
   * Initialize auto-save functionality with debouncing
   */
  private initializeAutoSave(): void {
    this.autoSaveSubject
      .pipe(
        debounceTime(this.AUTO_SAVE_DEBOUNCE_TIME),
        distinctUntilChanged((a, b) => a.updatedAt.getTime() === b.updatedAt.getTime()),
      )
      .subscribe(trip => {
        this.saveDraft(trip);
      });
  }
}
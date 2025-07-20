import { Trip } from '@trip-planner/types';

/**
 * Interface for trip draft repository operations
 * Defines the contract for local draft storage management
 */
export interface ITripDraftRepository {
  /**
   * Load draft trip from localStorage
   * @param tripId - ID of the trip to load
   * @returns Trip if found, null otherwise
   */
  loadDraft(tripId: string): Trip | null;

  /**
   * Save draft trip to localStorage immediately
   * @param trip - Trip to save as draft
   */
  saveDraft(trip: Trip): void;

  /**
   * Clear draft trip from localStorage
   * @param tripId - ID of the trip draft to clear
   */
  clearDraft(tripId: string): void;

  /**
   * Schedule auto-save for a trip (debounced)
   * @param trip - Trip to auto-save
   */
  scheduleAutoSave(trip: Trip): void;

  /**
   * Check if a draft exists for a trip
   * @param tripId - ID of the trip to check
   * @returns true if draft exists, false otherwise
   */
  hasDraft(tripId: string): boolean;

  /**
   * Get all draft trip IDs
   * @returns Array of trip IDs that have drafts
   */
  getAllDraftIds(): string[];

  /**
   * Clear all draft trips
   */
  clearAllDrafts(): void;
}
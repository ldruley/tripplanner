import { Injectable, inject, signal, computed } from '@angular/core';
import { TripEventBus } from '../events/trip-event.bus';
import { 
  TripStatus, 
  TripStateMachineEvent, 
  isValidTransition, 
  getValidTransitions, 
  getNextState,
  INITIAL_STATE_EVENTS 
} from './trip-states';

/**
 * State change event payload
 */
export interface StateChangeEventPayload {
  tripId: string | null;
  oldState: TripStatus | null;
  newState: TripStatus | null;
  event: TripStateMachineEvent;
}

/**
 * Trip State Machine Service
 * 
 * Manages the lifecycle state of the current trip, ensuring valid state transitions
 * and coordinating with the event system for reactive updates.
 */
@Injectable({ providedIn: 'root' })
export class TripStateMachine {
  private readonly tripEventBus = inject(TripEventBus);

  // State signals
  private readonly _currentState = signal<TripStatus | null>(null);
  private readonly _currentTripId = signal<string | null>(null);
  private readonly _isTransitioning = signal<boolean>(false);

  // Public readonly signals
  readonly currentState = this._currentState.asReadonly();
  readonly currentTripId = this._currentTripId.asReadonly();
  readonly isTransitioning = this._isTransitioning.asReadonly();

  // Computed properties
  readonly hasActiveTrip = computed(() => this._currentState() !== null);
  readonly isDraft = computed(() => this._currentState() === 'draft');
  readonly isPersisted = computed(() => this._currentState() === 'persisted');
  readonly validTransitions = computed(() => {
    const state = this._currentState();
    return state ? getValidTransitions(state) : INITIAL_STATE_EVENTS;
  });

  /**
   * Check if a transition is valid from the current state
   */
  canTransition(event: TripStateMachineEvent): boolean {
    const currentState = this._currentState();
    
    // If no current state, only initial events are allowed
    if (currentState === null) {
      return INITIAL_STATE_EVENTS.includes(event);
    }
    
    return isValidTransition(currentState, event);
  }

  /**
   * Get all valid transitions from the current state
   */
  getValidTransitions(): TripStateMachineEvent[] {
    const currentState = this._currentState();
    return currentState ? getValidTransitions(currentState) : INITIAL_STATE_EVENTS;
  }

  /**
   * Transition to a new state
   */
  transition(event: TripStateMachineEvent, tripId?: string): boolean {
    if (this._isTransitioning()) {
      console.warn('State machine is already transitioning, ignoring event:', event);
      return false;
    }

    if (!this.canTransition(event)) {
      console.warn(`Invalid state transition: ${this._currentState()} -> ${event}`);
      return false;
    }

    this._isTransitioning.set(true);

    const oldState = this._currentState();
    const oldTripId = this._currentTripId();
    
    try {
      // Handle special case for CLEAR_STATE
      if (event === 'CLEAR_STATE') {
        this._currentState.set(null);
        this._currentTripId.set(null);
      } else {
        const newState = getNextState(oldState || 'draft', event);
        this._currentState.set(newState);
        
        // Update trip ID if provided
        if (tripId !== undefined) {
          this._currentTripId.set(tripId);
        }
      }

      const newState = this._currentState();
      const newTripId = this._currentTripId();

      // Publish state change event
      this.tripEventBus.publish({
        type: '[Trip] State Changed',
        payload: {
          tripId: newTripId,
          oldState,
          newState,
          event
        }
      });

      console.log(`Trip state transition: ${oldState} -> ${newState} (event: ${event}, tripId: ${newTripId})`);
      return true;

    } catch (error) {
      console.error('Error during state transition:', error);
      return false;
    } finally {
      this._isTransitioning.set(false);
    }
  }

  /**
   * Initialize the state machine with a specific state (used when loading trips)
   */
  initializeState(state: TripStatus, tripId: string | null = null): void {
    const event: TripStateMachineEvent = state === 'draft' ? 'LOAD_DRAFT' : 'LOAD_PERSISTED';
    this.transition(event, tripId || undefined);
  }

  /**
   * Reset the state machine to initial state
   */
  reset(): void {
    this.transition('CLEAR_STATE');
  }

  /**
   * Get current state information
   */
  getStateInfo(): {
    state: TripStatus | null;
    tripId: string | null;
    isTransitioning: boolean;
    validTransitions: TripStateMachineEvent[];
  } {
    return {
      state: this._currentState(),
      tripId: this._currentTripId(),
      isTransitioning: this._isTransitioning(),
      validTransitions: this.getValidTransitions()
    };
  }
}
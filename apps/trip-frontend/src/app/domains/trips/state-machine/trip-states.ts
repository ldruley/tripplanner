/**
 * Trip State Machine Types and Transition Rules
 * 
 * This module defines the states and transitions for trip lifecycle management.
 * Draft trips are local-only, while persisted trips are saved on the server.
 */

/**
 * Trip status enumeration
 * - draft: Trip exists only locally (in TripStateService or localStorage)
 * - persisted: Trip has been saved to the server and has an ID
 */
export type TripStatus = 'draft' | 'persisted';

/**
 * Events that can trigger state transitions
 */
export type TripStateMachineEvent = 
  | 'CREATE_DRAFT'      // Create a new draft trip
  | 'PERSIST_TRIP'      // Save draft trip to server
  | 'LOAD_DRAFT'        // Load a draft from local storage
  | 'LOAD_PERSISTED'    // Load a persisted trip from server
  | 'CLEAR_STATE';      // Clear current trip state

/**
 * State transition rules defining valid transitions
 */
export const TRIP_STATE_TRANSITIONS: Record<TripStatus, TripStateMachineEvent[]> = {
  draft: [
    'PERSIST_TRIP',     // Draft can be persisted to server
    'CLEAR_STATE'       // Draft can be cleared
  ],
  persisted: [
    'CLEAR_STATE'       // Persisted trip can be cleared (but remains on server)
  ]
};

/**
 * Initial states that can be set directly (not through transitions)
 */
export const INITIAL_STATE_EVENTS: TripStateMachineEvent[] = [
  'CREATE_DRAFT',
  'LOAD_DRAFT',
  'LOAD_PERSISTED'
];

/**
 * Helper function to check if a transition is valid
 */
export function isValidTransition(currentState: TripStatus, event: TripStateMachineEvent): boolean {
  // Initial state events are always valid when setting up a trip
  if (INITIAL_STATE_EVENTS.includes(event)) {
    return true;
  }
  
  return TRIP_STATE_TRANSITIONS[currentState]?.includes(event) ?? false;
}

/**
 * Helper function to get valid transitions for a given state
 */
export function getValidTransitions(currentState: TripStatus): TripStateMachineEvent[] {
  return TRIP_STATE_TRANSITIONS[currentState] || [];
}

/**
 * Helper function to determine the resulting state from an event
 */
export function getNextState(currentState: TripStatus, event: TripStateMachineEvent): TripStatus {
  switch (event) {
    case 'CREATE_DRAFT':
    case 'LOAD_DRAFT':
      return 'draft';
    
    case 'PERSIST_TRIP':
    case 'LOAD_PERSISTED':
      return 'persisted';
    
    case 'CLEAR_STATE':
      // State becomes undefined/null, but we'll handle this in the state machine
      return currentState; // Keep current state, actual clearing handled by caller
    
    default:
      return currentState;
  }
}
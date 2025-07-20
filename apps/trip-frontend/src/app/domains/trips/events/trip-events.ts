import { Trip, Stop } from '@trip-planner/types';
import { TripStatus, TripStateMachineEvent } from '../state-machine/trip-states';

/**
 * Trip Created Event
 * Dispatched when a new trip is created
 */
export interface TripCreatedEvent {
  type: '[Trip] Created';
  payload: { 
    tripId: string; 
    trip: Trip 
  };
}

/**
 * Trip Updated Event
 * Dispatched when a trip is updated
 */
export interface TripUpdatedEvent {
  type: '[Trip] Updated';
  payload: { 
    tripId: string; 
    updates: Partial<Trip> 
  };
}

/**
 * Trip Deleted Event
 * Dispatched when a trip is deleted
 */
export interface TripDeletedEvent {
  type: '[Trip] Deleted';
  payload: { 
    tripId: string 
  };
}

/**
 * Stop Added Event
 * Dispatched when a stop is added to a trip
 */
export interface StopAddedEvent {
  type: '[Stop] Added';
  payload: { 
    tripId: string; 
    stop: Stop 
  };
}

/**
 * Stop Updated Event
 * Dispatched when a stop is updated
 */
export interface StopUpdatedEvent {
  type: '[Stop] Updated';
  payload: { 
    tripId: string; 
    stopId: string; 
    updates: Partial<Stop> 
  };
}

/**
 * Stop Removed Event
 * Dispatched when a stop is removed from a trip
 */
export interface StopRemovedEvent {
  type: '[Stop] Removed';
  payload: { 
    tripId: string; 
    stopId: string 
  };
}

/**
 * Trip Saved Event
 * Dispatched when a trip is successfully saved (auto-save or manual save)
 */
export interface TripSavedEvent {
  type: '[Trip] Saved';
  payload: { 
    tripId: string; 
    saveType: 'auto' | 'manual' 
  };
}

/**
 * Trip State Changed Event
 * Dispatched when trip state machine transitions occur
 */
export interface TripStateChangedEvent {
  type: '[Trip] State Changed';
  payload: { 
    tripId: string | null;
    oldState: TripStatus | null;
    newState: TripStatus | null;
    event: TripStateMachineEvent;
  };
}

/**
 * Union type for all trip-related domain events
 */
export type TripDomainEvent = 
  | TripCreatedEvent 
  | TripUpdatedEvent 
  | TripDeletedEvent
  | StopAddedEvent 
  | StopUpdatedEvent 
  | StopRemovedEvent
  | TripSavedEvent
  | TripStateChangedEvent;
import { Trip, Stop, Location, TripBankedLocation } from '@trip-planner/types';
import { TripStatus, TripStateMachineEvent } from '../state-machine/trip-states';
import { CoordinateMatrix } from '../../../../../../../libs/shared/types/src/schemas/matrix.schema';

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
 * Banked Location Added Event
 * Dispatched when a location is added to a trip's bank
 */
export interface BankedLocationAddedEvent {
  type: '[BankedLocation] Added';
  payload: { 
    tripId: string; 
    bankedLocation: TripBankedLocation 
  };
}

/**
 * Banked Location Removed Event
 * Dispatched when a location is removed from a trip's bank
 */
export interface BankedLocationRemovedEvent {
  type: '[BankedLocation] Removed';
  payload: { 
    tripId: string; 
    locationId: string 
  };
}

/**
 * Matrix Update Requested Event
 * Dispatched when a matrix update is requested due to location changes
 */
export interface MatrixUpdateRequestedEvent {
  type: '[Trip] Matrix Update Requested';
  payload: { 
    tripId: string; 
    locations: Location[] 
  };
}

/**
 * Matrix Updated Event
 * Dispatched when a trip's travel matrix has been successfully calculated
 */
export interface MatrixUpdatedEvent {
  type: '[Trip] Matrix Updated';
  payload: { 
    tripId: string; 
    matrix: CoordinateMatrix 
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
  | TripStateChangedEvent
  | BankedLocationAddedEvent
  | BankedLocationRemovedEvent
  | MatrixUpdateRequestedEvent
  | MatrixUpdatedEvent;
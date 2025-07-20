import { Trip, Stop, Location } from '@trip-planner/types';

/**
 * Base Command interface for all trip domain commands
 * Commands represent an intent to perform a write operation
 */
export interface Command<TResult = void> {
  readonly type: string;
  // Add common properties like userId, correlationId if needed
}

/**
 * Create Trip Command
 * Used to create a new trip
 */
export interface CreateTripCommand extends Command<{ tripId: string }> {
  readonly type: '[Trip] Create Trip';
  readonly payload: { 
    name: string; 
    description?: string; 
  };
}

/**
 * Update Trip Command
 * Used to update an existing trip
 */
export interface UpdateTripCommand extends Command<void> {
  readonly type: '[Trip] Update Trip';
  readonly payload: { 
    tripId: string; 
    updates: Partial<Trip>; 
  };
}

/**
 * Delete Trip Command
 * Used to delete an existing trip
 */
export interface DeleteTripCommand extends Command<void> {
  readonly type: '[Trip] Delete Trip';
  readonly payload: { 
    tripId: string; 
  };
}

/**
 * Add Stop Command
 * Used to add a stop to a trip's itinerary
 */
export interface AddStopCommand extends Command<void> {
  readonly type: '[Stop] Add Stop';
  readonly payload: { 
    tripId: string; 
    location: Location;
    insertAtIndex?: number;
  };
}

/**
 * Remove Stop Command
 * Used to remove a stop from a trip's itinerary
 */
export interface RemoveStopCommand extends Command<void> {
  readonly type: '[Stop] Remove Stop';
  readonly payload: { 
    tripId: string; 
    stopId: string; 
  };
}

/**
 * Update Stop Command
 * Used to update a stop in a trip's itinerary
 */
export interface UpdateStopCommand extends Command<void> {
  readonly type: '[Stop] Update Stop';
  readonly payload: { 
    tripId: string; 
    stopId: string; 
    updates: Partial<Stop>; 
  };
}

/**
 * Add Banked Location Command
 * Used to add a location to a trip's banked locations
 */
export interface AddBankedLocationCommand extends Command<void> {
  readonly type: '[BankedLocation] Add Banked Location';
  readonly payload: { 
    tripId: string; 
    location: Location; 
  };
}

/**
 * Remove Banked Location Command
 * Used to remove a location from a trip's banked locations
 */
export interface RemoveBankedLocationCommand extends Command<void> {
  readonly type: '[BankedLocation] Remove Banked Location';
  readonly payload: { 
    tripId: string; 
    locationId: string; 
  };
}

/**
 * Union type for all trip-related commands
 */
export type TripCommand = 
  | CreateTripCommand
  | UpdateTripCommand
  | DeleteTripCommand
  | AddStopCommand
  | RemoveStopCommand
  | UpdateStopCommand
  | AddBankedLocationCommand
  | RemoveBankedLocationCommand;
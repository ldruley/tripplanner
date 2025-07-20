import { Trip, Stop, Location, LocationForItinerary } from '@trip-planner/types';
import { UpdateTripWithRoutingRequest } from '@trip-planner/types';

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
 * Create Trip With Itinerary Command
 * Used to create a new trip with full itinerary data
 */
export interface CreateTripWithItineraryCommand extends Command<{ tripId: string }> {
  readonly type: '[Trip] Create Trip With Itinerary';
  readonly payload: { 
    tripData: {
      name: string;
      description?: string;
      startDate?: Date;
      endDate?: Date;
      matrix?: string;
    };
    organizedLocations: LocationForItinerary[];
  };
}

/**
 * Reorder Stops Command
 * Used to reorder stops in a trip's itinerary
 */
export interface ReorderStopsCommand extends Command<void> {
  readonly type: '[Stop] Reorder Stops';
  readonly payload: { 
    tripId: string; 
    stopOrders: Array<{ stopId: string; newOrder: number }>;
  };
}

/**
 * Promote Banked Location To Stop Command
 * Used to promote a banked location to a stop
 */
export interface PromoteBankedLocationToStopCommand extends Command<void> {
  readonly type: '[BankedLocation] Promote To Stop';
  readonly payload: { 
    tripId: string; 
    locationId: string;
    position?: number;
  };
}

/**
 * Update Trip With Routing Command
 * Used to update trip with routing calculations
 */
export interface UpdateTripWithRoutingCommand extends Command<void> {
  readonly type: '[Trip] Update Trip With Routing';
  readonly payload: { 
    tripId: string; 
    updateData: UpdateTripWithRoutingRequest;
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
  | RemoveBankedLocationCommand
  | CreateTripWithItineraryCommand
  | ReorderStopsCommand
  | PromoteBankedLocationToStopCommand
  | UpdateTripWithRoutingCommand;
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, tap, map, finalize } from 'rxjs/operators';
import { TripServerRepository } from '../repositories/trip-server.repository';
import { TripStateService } from '../state/trip-state.service';
import { TripEventBus } from '../events/trip-event.bus';
import { TripStateMachine } from '../state-machine/trip-state.machine';
import {
  Command,
  CreateTripCommand,
  UpdateTripCommand,
  DeleteTripCommand,
  AddStopCommand,
  RemoveStopCommand,
  UpdateStopCommand,
  AddBankedLocationCommand,
  RemoveBankedLocationCommand,
  TripCommand
} from '../commands/trip-commands';
import {
  TripCreatedEvent,
  TripUpdatedEvent,
  TripDeletedEvent,
  StopAddedEvent,
  StopUpdatedEvent,
  StopRemovedEvent
} from '../events/trip-events';
import { Trip, Stop, TripBankedLocation } from '@trip-planner/types';

/**
 * TripCommandService
 *
 * Central dispatcher for all trip domain commands (write operations).
 * Handles command execution, state management, event publishing, and error handling.
 */
@Injectable({ providedIn: 'root' })
export class TripCommandService {
  private readonly tripServerRepository = inject(TripServerRepository);
  private readonly tripStateService = inject(TripStateService);
  private readonly tripEventBus = inject(TripEventBus);
  private readonly tripStateMachine = inject(TripStateMachine);

  /**
   * Dispatch a command for execution
   * @param command - The command to execute
   * @returns Observable with the command result
   */
  dispatch<TResult>(command: Command<TResult>): Observable<TResult> {
    this.tripStateService.setOperationInProgress(true); // Indicate operation in progress
    this.tripStateService.setError(null); // Clear any previous errors

    let operation$: Observable<TResult>;

    switch (command.type) {
      case '[Trip] Create Trip':
        operation$ = this.handleCreateTrip(command as CreateTripCommand) as Observable<TResult>;
        break;

      case '[Trip] Update Trip':
        operation$ = this.handleUpdateTrip(command as UpdateTripCommand) as Observable<TResult>;
        break;

      case '[Trip] Delete Trip':
        operation$ = this.handleDeleteTrip(command as DeleteTripCommand) as Observable<TResult>;
        break;

      case '[Stop] Add Stop':
        operation$ = this.handleAddStop(command as AddStopCommand) as Observable<TResult>;
        break;

      case '[Stop] Remove Stop':
        operation$ = this.handleRemoveStop(command as RemoveStopCommand) as Observable<TResult>;
        break;

      case '[Stop] Update Stop':
        operation$ = this.handleUpdateStop(command as UpdateStopCommand) as Observable<TResult>;
        break;

      case '[BankedLocation] Add Banked Location':
        operation$ = this.handleAddBankedLocation(command as AddBankedLocationCommand) as Observable<TResult>;
        break;

      case '[BankedLocation] Remove Banked Location':
        operation$ = this.handleRemoveBankedLocation(command as RemoveBankedLocationCommand) as Observable<TResult>;
        break;

      default:
        return throwError(() => new Error(`Unknown command type: ${(command as any).type}`));
    }

    return operation$.pipe(
      catchError(error => {
        const errorMessage = error?.message || 'An unknown error occurred.';
        this.tripStateService.setError(errorMessage);
        return throwError(() => error);
      }),
      finalize(() => this.tripStateService.setOperationInProgress(false))
    );
  }

  /**
   * Handle Create Trip Command
   */
  private handleCreateTrip(command: CreateTripCommand): Observable<{ tripId: string }> {
    return from(this.tripServerRepository.createTrip(command.payload.name, command.payload.description)).pipe(
      tap(trip => {
        this.tripStateService.setTrip(trip, 'persisted', false); // Set current trip
        
        // Transition state machine to persisted state
        this.tripStateMachine.transition('PERSIST_TRIP', trip.id);
        
        this.tripEventBus.publish<TripCreatedEvent>({
          type: '[Trip] Created',
          payload: { tripId: trip.id, trip: trip }
        });
      }),
      map(trip => ({ tripId: trip.id })) // Return tripId as result
    );
  }

  /**
   * Handle Update Trip Command
   */
  private handleUpdateTrip(command: UpdateTripCommand): Observable<void> {
    // Validate that we can update the trip based on current state
    const currentState = this.tripStateMachine.currentState();
    if (currentState === null) {
      return throwError(() => new Error('No active trip to update'));
    }

    return from(this.tripServerRepository.updateTrip(command.payload.tripId, command.payload.updates)).pipe(
      tap(trip => {
        this.tripStateService.setTrip(trip, 'persisted', false); // Update state with full trip
        this.tripEventBus.publish<TripUpdatedEvent>({
          type: '[Trip] Updated',
          payload: { tripId: trip.id, updates: command.payload.updates }
        });
      }),
      map(() => void 0) // No specific result needed
    );
  }

  /**
   * Handle Delete Trip Command
   */
  private handleDeleteTrip(command: DeleteTripCommand): Observable<void> {
    return from(this.tripServerRepository.deleteTrip(command.payload.tripId)).pipe(
      tap(() => {
        this.tripStateService.clearState(); // Clear state after deletion
        
        // Reset state machine
        this.tripStateMachine.reset();
        
        this.tripEventBus.publish<TripDeletedEvent>({
          type: '[Trip] Deleted',
          payload: { tripId: command.payload.tripId }
        });
      }),
      map(() => void 0)
    );
  }

  /**
   * Handle Add Stop Command
   */
  private handleAddStop(command: AddStopCommand): Observable<void> {
    const currentTrip = this.tripStateService.currentTrip();
    if (!currentTrip) {
      return throwError(() => new Error('No current trip to add stop to'));
    }

    // Validate state machine allows stop modifications
    const currentState = this.tripStateMachine.currentState();
    if (currentState === null) {
      return throwError(() => new Error('No active trip state to modify'));
    }

    // Determine the order for the new stop
    const targetOrder = command.payload.insertAtIndex !== undefined
      ? command.payload.insertAtIndex
      : currentTrip.stops.length;

    // Create new stop
    const newStop: Stop = {
      id: crypto.randomUUID(),
      tripId: currentTrip.id,
      locationId: command.payload.location.id,
      order: targetOrder,
      plannedArrivalTime: null,
      plannedDuration: null,
      calculatedArrivalTime: null,
      calculatedDepartureTime: null,
      stopType: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      location: command.payload.location,
    };

    // Update orders for existing stops if inserting
    let updatedStops = [...currentTrip.stops];
    if (command.payload.insertAtIndex !== undefined) {
      updatedStops = updatedStops.map(stop =>
        stop.order >= command.payload.insertAtIndex! ? { ...stop, order: stop.order + 1 } : stop,
      );
    }

    // Add new stop and sort
    updatedStops.push(newStop);
    updatedStops.sort((a, b) => a.order - b.order);

    // Update state
    this.tripStateService.updateTrip({ stops: updatedStops });

    // Publish event
    this.tripEventBus.publish<StopAddedEvent>({
      type: '[Stop] Added',
      payload: { tripId: currentTrip.id, stop: newStop }
    });

    return from([void 0]);
  }

  /**
   * Handle Remove Stop Command
   */
  private handleRemoveStop(command: RemoveStopCommand): Observable<void> {
    const currentTrip = this.tripStateService.currentTrip();
    if (!currentTrip) {
      return throwError(() => new Error('No current trip to remove stop from'));
    }

    const stopToRemove = currentTrip.stops.find(s => s.id === command.payload.stopId);
    if (!stopToRemove) {
      return throwError(() => new Error(`Stop with ID ${command.payload.stopId} not found`));
    }

    // Remove stop and update orders
    const updatedStops = currentTrip.stops
      .filter(s => s.id !== command.payload.stopId)
      .map(stop => (stop.order > stopToRemove.order ? { ...stop, order: stop.order - 1 } : stop))
      .sort((a, b) => a.order - b.order);

    // Update state
    this.tripStateService.updateTrip({ stops: updatedStops });

    // Publish event
    this.tripEventBus.publish<StopRemovedEvent>({
      type: '[Stop] Removed',
      payload: { tripId: currentTrip.id, stopId: command.payload.stopId }
    });

    return from([void 0]);
  }

  /**
   * Handle Update Stop Command
   */
  private handleUpdateStop(command: UpdateStopCommand): Observable<void> {
    const currentTrip = this.tripStateService.currentTrip();
    if (!currentTrip) {
      return throwError(() => new Error('No current trip to update stop in'));
    }

    const updatedStops = currentTrip.stops.map(stop =>
      stop.id === command.payload.stopId
        ? { ...stop, ...command.payload.updates, updatedAt: new Date() }
        : stop,
    );

    // Update state
    this.tripStateService.updateTrip({ stops: updatedStops });

    // Publish event
    this.tripEventBus.publish<StopUpdatedEvent>({
      type: '[Stop] Updated',
      payload: {
        tripId: currentTrip.id,
        stopId: command.payload.stopId,
        updates: command.payload.updates
      }
    });

    return from([void 0]);
  }

  /**
   * Handle Add Banked Location Command
   */
  private handleAddBankedLocation(command: AddBankedLocationCommand): Observable<void> {
    const currentTrip = this.tripStateService.currentTrip();
    if (!currentTrip) {
      return throwError(() => new Error('No current trip to add banked location to'));
    }

    // Check if location is already banked
    const existingBanked = currentTrip.bankedLocations.find(bl => bl.locationId === command.payload.location.id);
    if (existingBanked) {
      return throwError(() => new Error('Location is already banked in this trip'));
    }

    // Create new banked location
    const bankedLocation: TripBankedLocation = {
      id: crypto.randomUUID(),
      tripId: currentTrip.id,
      locationId: command.payload.location.id,
      createdAt: new Date(),
      location: command.payload.location,
    };

    // Update state
    const updatedBankedLocations = [...currentTrip.bankedLocations, bankedLocation];
    this.tripStateService.updateTrip({ bankedLocations: updatedBankedLocations });

    return from([void 0]);
  }

  /**
   * Handle Remove Banked Location Command
   */
  private handleRemoveBankedLocation(command: RemoveBankedLocationCommand): Observable<void> {
    const currentTrip = this.tripStateService.currentTrip();
    if (!currentTrip) {
      return throwError(() => new Error('No current trip to remove banked location from'));
    }

    // Remove banked location
    const updatedBankedLocations = currentTrip.bankedLocations.filter(
      bl => bl.locationId !== command.payload.locationId
    );

    // Update state
    this.tripStateService.updateTrip({ bankedLocations: updatedBankedLocations });

    return from([void 0]);
  }
}

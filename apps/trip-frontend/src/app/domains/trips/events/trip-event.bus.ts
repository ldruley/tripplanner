import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { TripDomainEvent } from './trip-events';
import { environment } from '../../../../environments/environment';

/**
 * TripEventBus
 * 
 * Centralized, type-safe event system for the trip domain.
 * Enables loose coupling between different parts of the trip management system.
 */
@Injectable({ 
  providedIn: 'root' 
})
export class TripEventBus {
  private readonly eventStream = new Subject<TripDomainEvent>();

  /**
   * Publish an event to the event bus
   * @param event - The event to publish
   */
  publish<T extends TripDomainEvent>(event: T): void {
    // Development-only logging
    if (!environment.production) {
      console.log('[TripEventBus] Publishing event:', event.type, event.payload);
    }
    
    this.eventStream.next(event);
  }

  /**
   * Subscribe to events of a specific type
   * @param eventType - The type of event to listen for
   * @returns Observable stream of event payloads
   */
  on<T extends TripDomainEvent>(eventType: T['type']): Observable<T['payload']> {
    return this.eventStream.asObservable().pipe(
      filter((event): event is T => event.type === eventType),
      map(event => event.payload)
    );
  }

  /**
   * Subscribe to all events in the event bus
   * @returns Observable stream of all domain events
   */
  onAll(): Observable<TripDomainEvent> {
    return this.eventStream.asObservable();
  }

  /**
   * Get the total number of events published (for debugging/monitoring)
   */
  private eventCount = 0;
  
  getEventCount(): number {
    return this.eventCount;
  }

  constructor() {
    // Count events for debugging purposes
    this.eventStream.subscribe(() => {
      this.eventCount++;
    });
  }
}
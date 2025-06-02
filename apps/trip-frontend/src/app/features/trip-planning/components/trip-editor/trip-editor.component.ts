import { Component, input, output, WritableSignal, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocationSearchComponent } from '../../components/location-search/location-search.component';
import { Location } from '../../models/location.model';
import { Trip } from '../../models/trip.model';
import { Stop } from '../../models/stop.model';
@Component({
  selector: 'app-trip-editor',
  standalone: true,
  imports: [CommonModule, LocationSearchComponent],
  templateUrl: './trip-editor.component.html',
  styleUrls: ['./trip-editor.component.css']
})
export class TripEditorComponent {
  // Input for the initial trip data (from TripContainerComponent)
  initialTripData = input.required<Trip | null>();

  // Output event when the trip is saved
  readonly tripSaved = output<Trip>();

  // Internal state for the trip being edited
  // Initialize with a copy to avoid directly mutating the input
  // or handle new trip creation
  currentTrip: WritableSignal<Trip | null> = signal(null);

  // This signal will hold the locations/stops for the current trip
  // It will be derived from currentTrip.stops
  currentStops: WritableSignal<Stop[]> = signal([]);

  constructor() {
    // Effect to initialize or update currentTrip and currentStops when initialTripData changes
    effect(() => {
      const tripData = this.initialTripData();
      if (tripData) {
        // Create a deep copy if necessary to avoid mutating the input object directly
        this.currentTrip.set({ ...tripData, stops: [...tripData.stops] });
        this.currentStops.set([...tripData.stops]);
      } else {
        // Handle case where no initial data is provided (e.g. truly new trip from scratch if container didn't provide default)
        const newTrip: Trip = { id: crypto.randomUUID(), name: 'Untitled Trip', stops: [] };
        this.currentTrip.set(newTrip);
        this.currentStops.set([]);
      }
    });
  }

  onLocationSelectedFromSearch(selectedLocation: Location): void {
    const newStop: Stop = {
      id: crypto.randomUUID(),
      tripId: this.currentTrip()?.id || '',
      locationDetails: { ...selectedLocation }, // Copy location details for now
      order: this.currentStops().length // Simple order assignment
      // Add more later
    };

    this.currentStops.update(stops => [...stops, newStop]);
    // Also update the main trip object
    this.currentTrip.update(trip => {
      if (!trip) return null; // Should not happen if initialized
      return { ...trip, stops: [...trip.stops, newStop] };
    });
    console.log('TripEditor: Location added as stop:', newStop);
    console.log('TripEditor: Current trip state:', this.currentTrip());
  }

  saveTrip(): void {
    const tripToSave = this.currentTrip();
    if (tripToSave) {
      console.log('TripEditor: Saving trip...', tripToSave);
      this.tripSaved.emit(tripToSave);
    }
  }
  // More methods here
}

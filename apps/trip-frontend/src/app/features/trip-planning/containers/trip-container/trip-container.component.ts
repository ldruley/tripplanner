import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripEditorComponent } from '../../components/trip-editor/trip-editor.component';
import { ActivatedRoute } from '@angular/router';
import { Trip } from '../../models/trip.model';

@Component({
  selector: 'app-trip-container',
  standalone: true,
  imports: [CommonModule, TripEditorComponent],
  templateUrl: './trip-container.component.html',
  styleUrl: './trip-container.component.css',
})
export class TripContainerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  // private tripService = inject(TripService);

  trip: WritableSignal<Trip | null> = signal(null);
  isLoading: WritableSignal<boolean> = signal(true);
  tripId: WritableSignal<string | null> = signal(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.tripId.set(id);

    if (id && id !== 'new') {
      this.isLoading.set(true);
      // TODO: Fetch real trip data from the service
      console.log('Fetching trip data for ID:', id);

      setTimeout(() => {
        this.trip.set({
          id: id,
          name: `Trip ${id}`,
          stops: [],
        });
        this.isLoading.set(false);
      }, 1000);
    } else {
      // Handle 'new' trip scenario - start with a default new trip object
      console.log('TripContainer: Creating a new trip');
      this.trip.set({
        id: crypto.randomUUID(),
        name: 'New Untitled Trip',
        stops: [],
      });
      this.isLoading.set(false);
    }
  }

  // This method will be called when TripEditorComponent saves the trip
  handleTripSave(updatedTrip: Trip): void {
    console.log('TripContainer: Trip saved/updated by editor:', updatedTrip);
    this.isLoading.set(true);
    // TODO: Later, call TripService to save the trip to the backend
    // this.tripService.saveTrip(updatedTrip).subscribe(savedTrip => {
    //   this.trip.set(savedTrip);
    //   this.isLoading.set(false);
    //   // Navigate to view mode or show success message
    // });
    // Placeholder
    setTimeout(() => {
      this.trip.set(updatedTrip); // Optimistically update
      this.isLoading.set(false);
      console.log('TripContainer: Mock save complete.');
    }, 500);
  }
}

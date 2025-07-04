import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';

import { TripEditorComponent } from '../../components/trip-editor/trip-editor.component';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../shared/services';
import { Trip } from '../../models/trip.model';

@Component({
  selector: 'app-trip-container',
  standalone: true,
  imports: [TripEditorComponent],
  templateUrl: './trip-container.component.html',
  styleUrl: './trip-container.component.css',
})
export class TripContainerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
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
        this.toastService.showInfo('Trip loaded', `Loaded trip: ${id}`);
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
      this.toastService.showInfo('New trip', 'Started creating a new trip');
    }
  }

  // This method will be called when TripEditorComponent saves the trip
  handleTripSave(updatedTrip: Trip): void {
    console.log('TripContainer: Trip saved/updated by editor:', updatedTrip);
    this.isLoading.set(true);
    const loadingKey = 'trip-save-loading';
    this.toastService.showLoading(
      'Saving trip',
      'Please wait while we save your trip...',
      loadingKey
    );

    // TODO: Later, call TripService to save the trip to the backend
    // this.tripService.saveTrip(updatedTrip).subscribe(savedTrip => {
    //   this.trip.set(savedTrip);
    //   this.isLoading.set(false);
    //   this.toastService.clear(loadingKey);
    //   this.toastService.showSuccess(
    //     'Trip saved!',
    //     'Your trip has been successfully saved.'
    //   );
    // });

    // Placeholder simulation
    setTimeout(() => {
      this.trip.set(updatedTrip); // Optimistically update
      this.isLoading.set(false);
      console.log('TripContainer: Mock save complete.');
      this.toastService.clear(loadingKey);
      this.toastService.showSuccess(
        'Trip saved!',
        `"${updatedTrip.name}" has been successfully saved.`
      );
    }, 500);
  }
}

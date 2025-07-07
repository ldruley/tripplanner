import { Component, inject, OnInit, computed } from '@angular/core';

import { TripEditorComponent } from '../../components/trip-editor/trip-editor.component';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../shared/services';
import { TripDataService } from '../../services/trip-data.service';

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
  private tripDataService = inject(TripDataService);

  // Use service signals for reactive state
  trip = this.tripDataService.currentTrip;
  isLoading = this.tripDataService.isLoading;
  dataSource = this.tripDataService.dataSource;
  error = this.tripDataService.error;
  
  // Computed properties
  tripId = computed(() => this.route.snapshot.paramMap.get('id'));
  
  ngOnInit(): void {
    // Check if this is the 'new' route or a specific trip ID route
    const urlPath = this.route.snapshot.url.map(segment => segment.path).join('/');
    
    let tripId: string;
    
    if (urlPath === 'new') {
      tripId = 'new';
    } else {
      // Try to get the tripId parameter for existing trips
      const id = this.route.snapshot.paramMap.get('tripId');
      if (id) {
        tripId = id;
      } else {
        console.error('TripContainer: No trip ID found and not a new trip');
        return;
      }
    }
    
    console.log('TripContainer: Initializing trip:', tripId);
    
    // Initialize trip through service
    this.tripDataService.initializeTrip(tripId);
    
    // Show appropriate toast based on data source
    this.showInitializationToast(tripId);
  }

  // This method will be called when TripEditorComponent saves the trip
  handleTripSave(): void {
    const currentTrip = this.tripDataService.currentTrip();
    if (!currentTrip) return;

    console.log('TripContainer: Saving trip to backend:', currentTrip);
    const loadingKey = 'trip-save-loading';
    this.toastService.showLoading(
      'Saving trip',
      'Please wait while we save your trip...',
      loadingKey
    );

    this.tripDataService.saveTripToBackend().subscribe({
      next: (savedTrip) => {
        this.toastService.clear(loadingKey);
        this.toastService.showSuccess(
          'Trip saved!',
          `"${savedTrip.name}" has been successfully saved.`
        );
        console.log('TripContainer: Trip saved successfully');
      },
      error: (error) => {
        this.toastService.clear(loadingKey);
        this.toastService.showError(
          'Save failed',
          `Failed to save trip: ${error.message}`
        );
        console.error('TripContainer: Save failed:', error);
      }
    });
  }

  private showInitializationToast(_id: string): void {
    // Wait for initialization to complete before showing toast
    setTimeout(() => {
      const dataSource = this.tripDataService.dataSource();
      const tripName = this.tripDataService.tripName();
      
      switch (dataSource) {
        case 'new':
          this.toastService.showInfo('New trip', 'Started creating a new trip');
          break;
        case 'draft':
          this.toastService.showInfo('Draft loaded', `Loaded draft: ${tripName}`);
          break;
        case 'persisted':
          this.toastService.showInfo('Trip loaded', `Loaded trip: ${tripName}`);
          break;
      }
    }, 100);
  }
}

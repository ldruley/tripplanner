import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripDataService } from '../../services/trip-data.service';

@Component({
  selector: 'app-trip-details-view',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './trip-details-view.component.html',
  styleUrl: './trip-details-view.component.css',
})
export class TripDetailsViewComponent {
  private tripDataService = inject(TripDataService);

  // Access trip data through service signals
  trip = this.tripDataService.currentTrip;
  isLoading = this.tripDataService.isLoading;
  error = this.tripDataService.error;
  
  // Computed properties for trip details
  tripName = computed(() => this.trip()?.name || 'Untitled Trip');
  tripDescription = computed(() => this.trip()?.description || '');
  stopCount = computed(() => this.trip()?.stops?.length || 0);
  
  // Placeholder methods for future functionality
  onEditTripDetails(): void {
    console.log('Edit trip details clicked');
    // TODO: Implement trip details editing
  }

  onTripSettings(): void {
    console.log('Trip settings clicked');
    // TODO: Implement trip settings
  }

  onExportTrip(): void {
    console.log('Export trip clicked');
    // TODO: Implement trip export
  }

  onShareTrip(): void {
    console.log('Share trip clicked');
    // TODO: Implement trip sharing
  }
}
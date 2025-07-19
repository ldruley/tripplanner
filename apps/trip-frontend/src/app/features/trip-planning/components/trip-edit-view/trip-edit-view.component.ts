import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ActivatedRoute, Router } from '@angular/router';
import { ToastService, LocationService } from '../../../shared/services';
import { TripDataService } from '../../services/trip-data.service';
import { MatrixCalculationService } from '../../services/matrix-calculation.service';
import { LocationSearchComponent } from '../../../shared/components/location-search/location-search.component';
import { LocationBankComponent } from '../location-bank/location-bank.component';
import { ItineraryBuilderComponent } from '../itinerary-builder/itinerary-builder.component';
import { StopEditModalComponent } from '../stop-edit-modal/stop-edit-modal.component';
import { FloatingActionButtonComponent } from '../../../shared/components/floating-action-button/floating-action-button.component';
import {
  TripEditControlsComponent,
  TripEditControlsData,
} from '../trip-edit-controls/trip-edit-controls.component';
import { Location, Stop } from '@trip-planner/types';

@Component({
  selector: 'app-trip-edit-view',
  standalone: true,
  imports: [
    CommonModule,
    LocationSearchComponent,
    LocationBankComponent,
    ItineraryBuilderComponent,
    StopEditModalComponent,
    TripEditControlsComponent,
    FloatingActionButtonComponent,
  ],
  templateUrl: './trip-edit-view.component.html',
  styleUrl: './trip-edit-view.component.css',
})
export class TripEditViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private locationService = inject(LocationService);
  private tripDataService = inject(TripDataService);
  private matrixCalculationService = inject(MatrixCalculationService);

  // Use service signals for reactive state
  trip = this.tripDataService.currentTrip;
  isLoading = this.tripDataService.isLoading;
  dataSource = this.tripDataService.dataSource;
  error = this.tripDataService.error;
  bankedLocations = this.tripDataService.bankedLocations;
  itineraryStops = this.tripDataService.itineraryStops;
  matrixData = this.matrixCalculationService.formattedMatrix;

  // Transform banked locations to Location[] for the bank component
  bankedLocationsForBank = computed(() =>
    this.bankedLocations()
      .map(bl => bl.location)
      .filter(loc => loc !== undefined),
  );

  // Layout state management signals
  isLocationBankEmpty = computed(() => this.bankedLocations().length === 0);
  currentMobileView = signal<'bank' | 'itinerary'>('bank');

  // Stop edit modal state
  isStopEditModalOpen = signal<boolean>(false);
  editingStop = signal<Stop | null>(null);

  // Computed properties - get current trip ID from URL
  tripId = computed(() => {
    // Extract trip ID from current URL path
    const url = this.router.url;
    const match = url.match(/\/trip-planning\/([^\/]+)/);
    return match ? match[1] : 'new';
  });

  ngOnInit(): void {
    // Trip initialization is handled by TripContainerComponent
    // This component only reacts to trip data changes through service signals
  }

  // Mobile view switching methods
  showBankView(): void {
    this.currentMobileView.set('bank');
  }

  showItineraryView(): void {
    this.currentMobileView.set('itinerary');
  }

  // Location handling methods
  onLocationSelected(location: Location): void {
    // Location is already created by backend, add to bank directly
    this.tripDataService.addLocationToBank(location);
    // Switch to bank view on mobile after adding location
    if (window.innerWidth < 768) {
      this.showBankView();
    }
  }

  onLocationAddedToItinerary(location: Location): void {
    // Location is already created by backend, add to itinerary directly
    this.tripDataService.addStopToItinerary(location);
    // Switch to itinerary view on mobile after adding location
    if (window.innerWidth < 768) {
      this.showItineraryView();
    }
  }

  onLocationDroppedFromBank(event: { itemData: Location; newIndex: number }): void {
    // Remove from bank first, then add to itinerary
    this.tripDataService.removeLocationFromBank(event.itemData.id);
    this.tripDataService.addStopToItinerary(event.itemData, event.newIndex);
  }

  onStopDroppedToBank(event: { itemData: any; newIndex: number }): void {
    // Handle dropping a stop from itinerary back to bank
    // This should remove the stop from itinerary and add location back to bank
    console.log('Stop dropped to bank:', event.itemData);
    if (event.itemData.id) {
      this.tripDataService.removeStopFromItinerary(event.itemData.id);
    }
  }

  onLocationRemovedFromBank(event: { itemData: Location; newIndex: number }): void {
    // Handle removing a location from the bank
    console.log('Location removed from bank:', event.itemData);
    this.tripDataService.removeLocationFromBank(event.itemData.id);
  }

  onLocationDragStarted(location: Location): void {
    console.log('Drag started for location:', location.name);
  }

  onItineraryReorder(stops: any[]): void {
    // Extract stop IDs from the reordered stops
    const stopIds = stops.map(stop => stop.id);
    this.tripDataService.reorderStops(stopIds);
  }

  onStopRemoved(stopId: string): void {
    this.tripDataService.removeStopFromItinerary(stopId);
  }

  onStopEditRequested(stopId: string): void {
    const stops = this.itineraryStops();
    const stopToEdit = stops.find(stop => stop.id === stopId);
    if (stopToEdit) {
      this.editingStop.set(stopToEdit);
      this.isStopEditModalOpen.set(true);
    }
  }

  onStopEditModalClose(): void {
    this.isStopEditModalOpen.set(false);
    this.editingStop.set(null);
  }

  onStopUpdated(updatedStop: Stop): void {
    this.tripDataService.updateStop(updatedStop.id, updatedStop);
    this.onStopEditModalClose();
  }

  // Handle trip data changes from the trip-edit-controls component
  onTripDataChanged(tripData: TripEditControlsData): void {
    this.tripDataService.updateTripLocal({
      name: tripData.name,
      description: tripData.description,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
    });
  }

  // Handle trip save action
  handleTripSave(): void {
    const currentTrip = this.tripDataService.currentTrip();
    if (!currentTrip) return;

    const currentTripId = this.tripId();
    console.log('TripEditView: Saving trip to backend:', currentTrip);
    const loadingKey = 'trip-save-loading';
    this.toastService.showLoading(
      'Saving trip',
      'Please wait while we save your trip...',
      loadingKey,
    );

    this.tripDataService.saveTripToBackend().subscribe({
      next: savedTrip => {
        this.toastService.clear(loadingKey);
        this.toastService.showSuccess(
          'Trip saved!',
          `"${savedTrip.name}" has been successfully saved.`,
        );
        console.log('TripEditView: Trip saved successfully');

        // Navigate to the actual trip ID if we were on the 'new' route
        // The TripContainer will detect this navigation and skip re-initialization
        // since the current trip already matches the new route
        console.log('TripEditView: Checking navigation condition:', {
          currentTripId,
          savedTripId: savedTrip.id,
          shouldNavigate: currentTripId === 'new' && savedTrip.id
        });
        
        if (currentTripId === 'new' && savedTrip.id) {
          console.log('TripEditView: Navigating from /new to trip ID:', savedTrip.id);
          
          // Preserve current view context by checking current URL
          const currentPath = this.router.url;
          const targetPath = currentPath.replace('/new', `/${savedTrip.id}`);
          
          console.log('TripEditView: Current URL:', currentPath);
          console.log('TripEditView: Target URL:', targetPath);
          console.log('TripEditView: About to navigate...');
          
          this.router.navigateByUrl(targetPath).then(
            (success) => {
              console.log('TripEditView: Navigation success:', success);
            },
            (error) => {
              console.log('TripEditView: Navigation error:', error);
            }
          );
        }
      },
      error: error => {
        this.toastService.clear(loadingKey);
        this.toastService.showError('Save failed', `Failed to save trip: ${error.message}`);
        console.error('TripEditView: Save failed:', error);
      },
    });
  }


}

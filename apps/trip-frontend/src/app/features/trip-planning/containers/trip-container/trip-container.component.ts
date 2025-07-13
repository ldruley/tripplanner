import { Component, inject, OnInit, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ToastService } from '../../../shared/services';
import { TripDataService } from '../../services/trip-data.service';
import { MatrixCalculationService } from '../../services/matrix-calculation.service';
import { LocationSearchComponent } from '../../../shared/components/location-search/location-search.component';
import { LocationBankComponent } from '../../components/location-bank/location-bank.component';
import { ItineraryBuilderComponent } from '../../components/itinerary-builder/itinerary-builder.component';
import { StopEditModalComponent } from '../../components/stop-edit-modal/stop-edit-modal.component';
import { FloatingActionButtonComponent } from '../../../shared/components/floating-action-button/floating-action-button.component';
import {
  TripEditControlsComponent,
  TripEditControlsData,
} from '../../components/trip-edit-controls/trip-edit-controls.component';
import { Location, Stop } from '@trip-planner/types';

@Component({
  selector: 'app-trip-container',
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
  templateUrl: './trip-container.component.html',
  styleUrl: './trip-container.component.css',
})
export class TripContainerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastService = inject(ToastService);
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

  // Reactive route parameters
  private routeParams = toSignal(this.route.paramMap);
  private routeUrl = toSignal(this.route.url);
  
  // Computed properties
  tripId = computed(() => {
    const url = this.routeUrl();
    const params = this.routeParams();
    
    // Check if this is the 'new' route
    if (url && url.length > 0 && url[url.length - 1].path === 'new') {
      return 'new';
    }
    
    // Otherwise get tripId from route parameters
    return params?.get('tripId') || null;
  });

  // React to route changes and initialize trip accordingly (called in injection context)
  private tripInitializationEffect = effect(() => {
    const currentTripId = this.tripId();
    
    if (currentTripId) {
      console.log('TripContainer: Route changed, initializing trip:', currentTripId);
      this.tripDataService.initializeTrip(currentTripId);
      this.showInitializationToast(currentTripId);
    } else {
      console.error('TripContainer: No trip ID found in route');
    }
  });

  ngOnInit(): void {
    // Effect is already set up in the field initializer above
    // No additional initialization needed
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
    this.tripDataService.addLocationToBank(location);
    // Switch to bank view on mobile after adding location
    if (window.innerWidth < 768) {
      this.showBankView();
    }
  }

  onLocationAddedToItinerary(location: Location): void {
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

    console.log('TripContainer: Saving trip to backend:', currentTrip);
    const loadingKey = 'trip-save-loading';
    this.toastService.showLoading(
      'Saving trip',
      'Please wait while we save your trip...',
      loadingKey,
    );

    // Check if this is a new trip before saving by looking at the data source
    const isNewTrip = this.tripDataService.dataSource() === 'new';

    this.tripDataService.saveTripToBackend().subscribe({
      next: savedTrip => {
        this.toastService.clear(loadingKey);
        this.toastService.showSuccess(
          'Trip saved!',
          `"${savedTrip.name}" has been successfully saved.`,
        );
        console.log('TripContainer: Trip saved successfully');

        // Handle redirect for new trips that were just persisted
        if (isNewTrip && savedTrip.id) {
          console.log('TripContainer: Redirecting to persisted trip:', savedTrip.id);
          // Navigate to the persisted trip's URL
          this.router.navigate(['/trip-planning', savedTrip.id], { 
            replaceUrl: true // This replaces the current URL instead of adding to history
          });
        }
      },
      error: error => {
        this.toastService.clear(loadingKey);
        this.toastService.showError('Save failed', `Failed to save trip: ${error.message}`);
        console.error('TripContainer: Save failed:', error);
      },
    });
  }

  // Navigate to timeline view
  navigateToTimeline(): void {
    const currentTripId = this.tripId();
    console.log('Navigating to timeline, tripId:', currentTripId);
    console.log('Current route params:', this.route.snapshot.paramMap);
    console.log('Current URL:', this.route.snapshot.url);

    if (currentTripId && currentTripId !== 'new') {
      console.log('Attempting navigation to:', ['/trip-planning', currentTripId, 'timeline']);
      this.router.navigate(['/trip-planning', currentTripId, 'timeline']);
    } else {
      console.log('Navigation blocked - tripId is:', currentTripId);
    }
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

import { Component, inject, OnInit, computed, signal, DestroyRef, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { ActivatedRoute, Router } from '@angular/router';
import { ToastService, LocationService } from '../../../shared/services';
import { TripFacade } from '../../../../domains/trips';
import { LocationFacade } from '../../../../domains/locations';
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
  private tripFacade = inject(TripFacade);
  private locationFacade = inject(LocationFacade);
  private matrixCalculationService = inject(MatrixCalculationService);
  private destroyRef = inject(DestroyRef);

  // Output events
  readonly openTripDetailsRequested = output<void>();

  // Use facade signals for reactive state
  trip = this.tripFacade.currentTrip;
  isLoading = this.tripFacade.isLoading;
  dataSource = this.tripFacade.dataSource;
  error = this.tripFacade.error;
  bankedLocations = this.tripFacade.bankedLocations;
  itineraryStops = this.tripFacade.itineraryStops;
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

  // Computed properties - get current trip ID from facade or URL
  tripId = computed(() => {
    // First try to get trip ID from facade
    const facadeTripId = this.tripFacade.tripId();
    if (facadeTripId && !facadeTripId.startsWith('draft-')) {
      return facadeTripId;
    }

    // Fallback to extracting trip ID from current URL path
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
    const tripId = this.tripId();
    const isDraft = this.tripFacade.isDraftTrip();

    if (!tripId) {
      this.handleCommandError(new Error('No active trip to add location to'));
      return;
    }

    // Location is already created by backend, add to bank directly
    this.tripFacade.addBankedLocation(tripId, location)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const message = isDraft ? 'Location added to draft' : 'Location added to bank';
          this.toastService.showSuccess(message);
          // Switch to bank view on mobile after adding location
          if (window.innerWidth < 768) {
            this.showBankView();
          }
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  onLocationAddedToItinerary(location: Location): void {
    const tripId = this.tripId();
    const isDraft = this.tripFacade.isDraftTrip();

    if (!tripId) {
      this.handleCommandError(new Error('No active trip to add location to'));
      return;
    }

    // Location is already created by backend, add to itinerary directly
    this.tripFacade.addStop(tripId, location)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const message = isDraft ? 'Location added to draft itinerary' : 'Location added to itinerary';
          this.toastService.showSuccess(message);
          // Switch to itinerary view on mobile after adding location
          if (window.innerWidth < 768) {
            this.showItineraryView();
          }
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  onLocationDroppedFromBank(event: { itemData: Location; newIndex: number }): void {
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    // Remove from bank first, then add to itinerary
    this.tripFacade.removeBankedLocation(tripId, event.itemData.id)
      .pipe(
        switchMap(() => this.tripFacade.addStop(tripId, event.itemData, event.newIndex)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Location moved to itinerary');
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  onStopDroppedToBank(event: { itemData: any; newIndex: number }): void {
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    // Handle dropping a stop from itinerary back to bank
    // This should remove the stop from itinerary and add location back to bank
    console.log('Stop dropped to bank:', event.itemData);
    if (event.itemData.id) {
      this.tripFacade.removeStop(tripId, event.itemData.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.toastService.showSuccess('Stop moved back to bank');
          },
          error: (error) => this.handleCommandError(error)
        });
    }
  }

  onLocationRemovedFromBank(event: { itemData: Location; newIndex: number }): void {
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    // Handle removing a location from the bank
    console.log('Location removed from bank:', event.itemData);
    this.tripFacade.removeBankedLocation(tripId, event.itemData.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Location removed from bank');
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  onLocationDragStarted(location: Location): void {
    console.log('Drag started for location:', location.name);
  }

  onItineraryReorder(stops: any[]): void {
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    // Convert stops to stop orders format expected by facade
    const stopOrders = stops.map((stop, index) => ({
      stopId: stop.id,
      newOrder: index
    }));

    this.tripFacade.reorderStops(tripId, stopOrders)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // No toast needed for reordering as it's immediate visual feedback
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  onStopRemoved(stopId: string): void {
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    this.tripFacade.removeStop(tripId, stopId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Stop removed from itinerary');
        },
        error: (error) => this.handleCommandError(error)
      });
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
    const currentTrip = this.trip();
    const tripId = this.tripId();
    if (!currentTrip || !tripId) {
      this.handleCommandError(new Error('No trip loaded'));
      return;
    }

    this.tripFacade.updateStop(tripId, updatedStop.id, updatedStop)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Stop updated');
          this.onStopEditModalClose();
        },
        error: (error) => this.handleCommandError(error)
      });
  }

  // Handle trip data changes from the trip-edit-controls component
  onTripDataChanged(tripData: TripEditControlsData): void {
    this.tripFacade.updateTripLocally({
      name: tripData.name,
      description: tripData.description,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
    });
  }

  // Handle trip save action
  handleTripSave(): void {
    const currentTrip = this.tripFacade.currentTrip();
    if (!currentTrip) return;

    const currentTripId = this.tripId();
    console.log('TripEditView: Saving trip to backend:', currentTrip);
    const loadingKey = 'trip-save-loading';
    this.toastService.showLoading(
      'Saving trip',
      'Please wait while we save your trip...',
      loadingKey,
    );

    // If it's a draft trip, create it with itinerary data
    if (currentTripId === 'new' || currentTrip.id.startsWith('draft-')) {
      // For new trips, use createTripWithItinerary if there are locations
      const organizedLocations = [
        ...currentTrip.stops.map(stop => ({
          name: stop.location!.name,
          description: stop.location!.description || undefined,
          address: stop.location!.address || undefined,
          houseNumber: stop.location!.houseNumber || undefined,
          city: stop.location!.city || undefined,
          state: stop.location!.state || undefined,
          country: stop.location!.country || undefined,
          postalCode: stop.location!.postalCode || undefined,
          latitude: stop.location!.latitude,
          longitude: stop.location!.longitude,
          apiSource: stop.location!.apiSource || undefined,
          apiSourceId: stop.location!.apiSourceId || undefined,
          category: stop.location!.category || undefined,
          order: stop.order || 0
        })),
        ...currentTrip.bankedLocations.map((bl, index) => ({
          name: bl.location!.name,
          description: bl.location!.description || undefined,
          address: bl.location!.address || undefined,
          houseNumber: bl.location!.houseNumber || undefined,
          city: bl.location!.city || undefined,
          state: bl.location!.state || undefined,
          country: bl.location!.country || undefined,
          postalCode: bl.location!.postalCode || undefined,
          latitude: bl.location!.latitude,
          longitude: bl.location!.longitude,
          apiSource: bl.location!.apiSource || undefined,
          apiSourceId: bl.location!.apiSourceId || undefined,
          category: bl.location!.category || undefined,
          order: currentTrip.stops.length + index
        }))
      ];

      this.tripFacade.createTripWithItinerary(
        {
          name: currentTrip.name,
          description: currentTrip.description || undefined,
          startDate: currentTrip.startDate || undefined,
          endDate: currentTrip.endDate || undefined,
          matrix: currentTrip.matrix
        },
        organizedLocations
      ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.toastService.clear(loadingKey);
          this.toastService.showSuccess(
            'Trip saved!',
            `"${currentTrip.name}" has been successfully saved.`,
          );
          console.log('TripEditView: Trip created successfully');

          // Navigate to the actual trip ID
          const currentPath = this.router.url;
          const targetPath = currentPath.replace('/new', `/${result.tripId}`);

          this.router.navigateByUrl(targetPath).then(
            (success) => {
              console.log('TripEditView: Navigation success:', success);
            },
            (error) => {
              console.log('TripEditView: Navigation error:', error);
            }
          );
        },
        error: error => {
          this.toastService.clear(loadingKey);
          this.toastService.showError('Save failed', `Failed to save trip: ${error.message}`);
          console.error('TripEditView: Save failed:', error);
        }
      });
    } else {
      // For existing trips, just update the trip details
      this.tripFacade.updateTripDetails(currentTripId, {
        name: currentTrip.name,
        description: currentTrip.description,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate
      }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastService.clear(loadingKey);
          this.toastService.showSuccess(
            'Trip saved!',
            `"${currentTrip.name}" has been successfully updated.`,
          );
          console.log('TripEditView: Trip updated successfully');
        },
        error: error => {
          this.toastService.clear(loadingKey);
          this.toastService.showError('Save failed', `Failed to save trip: ${error.message}`);
          console.error('TripEditView: Save failed:', error);
        }
      });
    }
  }

  // Open trip details (mobile only)
  openTripDetails(): void {
    this.openTripDetailsRequested.emit();
  }

  // Error handling helper method
  private handleCommandError(error: any): void {
    console.error('Command execution failed:', error);
    this.toastService.showError(
      'Operation failed',
      error.message || 'Please try again'
    );
  }
}

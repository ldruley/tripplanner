import { Component, input, output, signal, WritableSignal, effect, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';

import { LocationSearchComponent } from '../location-search/location-search.component';
import { LocationBankComponent } from '../location-bank/location-bank.component';
import { ItineraryBuilderComponent } from '../itinerary-builder/itinerary-builder.component';

import { Location } from '../../models/location.model';
import { Trip } from '../../models/trip.model';
import { Stop } from '../../models/stop.model';
import { MatrixCalculationService } from '../../services/matrix-calculation.service';

// Services (placeholders for now)
// import { TripService } from '../../services/trip.service';
// import { MatrixApiService } from '../../services/matrix-api.service';

@Component({
  selector: 'app-trip-editor',
  standalone: true,
  imports: [
    FormsModule,
    LocationSearchComponent,
    LocationBankComponent,
    ItineraryBuilderComponent,
    CdkDropListGroup
],
  templateUrl: './trip-editor.component.html',
  styleUrls: ['./trip-editor.component.css'],
})
export class TripEditorComponent {
  // Input for the initial trip data (from TripContainerComponent)
  initialTripData = input.required<Trip | null>();

  // Output event when the trip is saved
  readonly tripSaved = output<Trip>();

  // Internal state for the trip being edited
  // These will be initialized by the effect watching initialTripData
  tripId: WritableSignal<string | null> = signal(null);
  currentTripName: WritableSignal<string> = signal('Untitled Trip');
  currentTripDescription: WritableSignal<string | undefined> = signal(undefined);

  bankedLocations: WritableSignal<Location[]> = signal([]);
  itineraryStops: WritableSignal<Stop[]> = signal([]);

  private matrixService = inject(MatrixCalculationService);
  // For Matrix API results
  matrixData = this.matrixService.formattedMatrix;
  isLoadingMatrix = this.matrixService.isLoading;

  // private tripService = inject(TripService);  For intermediate saves/persistence

  constructor() {
    // Effect to initialize/update local state when initialTripData changes
    effect(() => {
      const tripData = this.initialTripData();
      console.log(
        'TripEditor: Effect for initialTripData triggered. Processing tripData:',
        tripData,
      );

      if (tripData) {
        // Only set these if it's truly a new trip load or different trip ID
        // This check prevents wiping state if initialTripData reference changes but it's the same trip
        if (this.tripId() !== tripData.id) {
          console.log('TripEditor: New or different trip loaded. Resetting state.');
          this.tripId.set(tripData.id);
          this.currentTripName.set(tripData.name);
          this.currentTripDescription.set(tripData.description);
          this.itineraryStops.set([...tripData.stops].sort((a, b) => a.order - b.order));

          // Initialize bankedLocations based on initialTripData
          // IMPORTANT: Does your 'Trip' model from the backend/initialTripData actually
          // include a property for 'bankedLocations'? If so, use it here.
          // If 'bankedLocations' are purely session-based and not loaded with the trip,
          // then you should initialize it to [] only if tripId changes, or manage it outside this effect.
          if ('bankedLocations' in tripData && Array.isArray(tripData.bankedLocations)) {
            this.bankedLocations.set([...tripData.bankedLocations]);
            console.log('TripEditor: BankedLocations initialized from tripData.');
          } else {
            // If tripData doesn't contain bankedLocations, and we're loading a new trip,
            // then it's appropriate to reset it.
            // However, if we're just re-processing the same trip, we might want to preserve
            // session-banked locations. This logic depends on your exact requirements.
            // For now, let's assume if tripData.id changes, we reset bank.
            this.bankedLocations.set([]);
            console.log(
              'TripEditor: BankedLocations reset as initialTripData does not contain them or trip ID changed.',
            );
          }
        } else {
          // initialTripData reference might have changed, but it's for the same trip.
          // Potentially update name/description if they can change, but be careful with stops/bank.
          // For now, we'll assume if the ID is the same, we don't re-initialize stops/bank from initialTripData
          // as they are being actively managed by the user in this component.
          console.log(
            'TripEditor: initialTripData updated for the same trip. Name/Desc may update.',
          );
          this.currentTripName.set(tripData.name); // Still update these if they can change
          this.currentTripDescription.set(tripData.description);
        }
      } else {
        // initialTripData is null (e.g., explicitly for a new trip from container)
        console.log('TripEditor: initialTripData is null. Setting up for a new trip.');
        // This is for a "new trip" state if container passes null
        const newTripId = crypto.randomUUID(); // Or handle ID generation as needed
        this.tripId.set(newTripId);
        this.currentTripName.set('Untitled Trip');
        this.currentTripDescription.set(undefined);
        this.itineraryStops.set([]);
        this.bankedLocations.set([]); // Start with an empty bank for a new trip
      }
      // The call to fetchMatrixData can remain here if it depends on initialized stops/bank.
      // this.fetchMatrixData(); // This will be called when the signals it depends on are set
    });
  }

  /**
   * Called when a location is selected from the search component.
   * This location is added to the bank.
   */
  onLocationSelectedFromSearch(selectedLocation: Location): void {
    // TODO: Backend Call - Persist this location as "banked" for the current tripId()
    // For now, just update local state.
    this.bankedLocations.update(currentLocations => {
      const newBank = [...currentLocations, selectedLocation];
      console.log('TripEditor: Updating bankedLocations signal to:', newBank);
      if (currentLocations.find(loc => loc.id === selectedLocation.id)) {
        console.warn('Location already in bank:', selectedLocation.name);
        return currentLocations;
      }
      return [...currentLocations, selectedLocation];
    });
    console.log('TripEditor: Location added to bank:', selectedLocation.name);
  }

  /**
   * Called by ItineraryBuilderComponent when an item from the bank (Location)
   * is dropped into the itinerary.
   */
  handleItemDroppedFromBank({
    itemData,
    newIndex,
  }: {
    itemData: Location;
    newIndex: number;
  }): void {
    const locationToMove = itemData; // Now correctly accesses itemData which holds the Location

    // Create a new Stop object
    const newStop: Stop = {
      id: crypto.randomUUID(),
      tripId: this.tripId() || '',
      locationId: locationToMove.id,
      locationDetails: locationToMove,
      order: newIndex,
      tempClientId: crypto.randomUUID(),
    };

    // Remove from bankedLocations signal
    this.bankedLocations.update(bank => bank.filter(l => l.id !== locationToMove.id));

    // add to itineraryStops signal at the correct index and re-order all
    this.itineraryStops.update(stops => {
      const newStopsArray = [...stops];
      newStopsArray.splice(newIndex, 0, newStop);
      return newStopsArray.map((s, index) => ({ ...s, order: index }));
    });

    // TODO: Backend -
    // Call service to remove from bank persistence.
    // Call service to add as a new stop to itinerary persistence.
    console.log(`Moved ${locationToMove.name} from bank to itinerary at index ${newIndex}`);
  }

  /**
   * Called by ItineraryBuilderComponent when stops are reordered within the itinerary.
   */
  handleStopsReordered(reorderedStops: Stop[]): void {
    // TODO: Backend Call - Persist the new order of stops for this trip.
    // The reorderedStops array already has updated 'order' properties from ItineraryBuilder.
    this.itineraryStops.set(reorderedStops);
    console.log('TripEditor: Stops reordered.');
  }

  /**
   * Called by ItineraryBuilderComponent when a stop removal is requested.
   */
  handleRemoveStopRequest(stopIdToRemove: string): void {
    // TODO: Backend Call - Remove this stop from the trip's itinerary.
    this.itineraryStops.update(stops =>
      stops
        .filter(stop => {
          // If using tempClientId for newly added stops not yet saved, check that too
          return stop.id !== stopIdToRemove && stop.tempClientId !== stopIdToRemove;
        })
        .map((stop, index) => ({ ...stop, order: index })),
    ); // Re-order remaining
    console.log('TripEditor: Stop removal requested:', stopIdToRemove);
  }

  /**
   * Placeholder for handling edit requests from ItineraryStopComponent.
   */
  handleEditStopRequest(stopIdToEdit: string): void {
    console.log('TripEditor: Stop edit requested (not implemented yet):', stopIdToEdit);
    // Implement opening an edit modal or inline editing for the stop
  }

  handleBankDragStart(draggedLocation: Location): void {
    console.log(
      `TripEditor: Drag started for "${draggedLocation.name}". Triggering matrix calculation for ALL locations.`,
    );

    // 1. Get current locations from itinerary stops.
    const itineraryLocations = this.itineraryStops()
      .map(stop => stop.locationDetails)
      .filter((loc): loc is Location => loc != null); // Type guard to filter out nulls

    // 2. Get all locations currently in the bank.
    const bankLocations = this.bankedLocations();

    // 3. Combine and de-duplicate them to get the full set of locations.
    // Using a Map is an easy way to ensure uniqueness based on location ID.
    const allLocationsMap = new Map<string, Location>();
    [...itineraryLocations, ...bankLocations].forEach(loc => {
      allLocationsMap.set(loc.id, loc);
    });

    const uniqueLocations = Array.from(allLocationsMap.values());

    // 4. Call the service with the complete, unique list.
    this.matrixService.calculateMatrix(uniqueLocations);
  }

  /**
   * Simulates fetching matrix data.
   * In a real app, this would call MatrixApiService.
   */
  /*fetchMatrixData(): void {
    const stops = this.itineraryStops();
    const bank = this.bankedLocations();

    // Consolidate all unique locations
    const allLocationsMap = new Map<string, Location>();
    stops.forEach(stop => {
      if (stop.locationDetails) allLocationsMap.set(stop.locationDetails.id, stop.locationDetails);
    });
    bank.forEach(loc => allLocationsMap.set(loc.id, loc));

    const uniqueLocations = Array.from(allLocationsMap.values());

    if (uniqueLocations.length < 2) {
      this.matrixData.set(null); // Not enough points for a matrix
      return;
    }

    // console.log('TripEditor: Triggering matrix data calculation for locations:', uniqueLocations.map(l => l.name));
    this.isLoadingMatrix.set(true);

    // TODO: Replace with actual call to this.matrixApiService.getMatrix(uniqueLocations)
    setTimeout(() => {
      const mockMatrix = new Map<string, TravelSegmentData>();
      // Create mock data: iterate through itineraryStops to create segments
      const currentItinerary = this.itineraryStops();
      for (let i = 0; i < currentItinerary.length - 1; i++) {
        const fromLoc = currentItinerary[i].locationDetails;
        const toLoc = currentItinerary[i+1].locationDetails;
        if (fromLoc && toLoc) {
          const key = `${fromLoc.id}_${toLoc.id}`;
          mockMatrix.set(key, {
            time: `${Math.floor(Math.random() * 60) + 10} min`,
            distance: `${(Math.random() * 20 + 5).toFixed(1)} km`
          });
        }
      }
      this.matrixData.set(mockMatrix);
      this.isLoadingMatrix.set(false);
      // console.log('TripEditor: Mock matrix data set.');
    }, 1000); // Simulate API delay
  }*/

  /**
   * Prepares the final trip object and emits it to be saved by the parent container.
   */
  saveTrip(): void {
    const tripId = this.tripId();
    if (!tripId) {
      console.error('TripEditor: Cannot save trip, ID is missing.');
      return;
    }

    const finalTrip: Trip = {
      id: tripId,
      name: this.currentTripName(),
      description: this.currentTripDescription(),
      stops: this.itineraryStops().map((stop, index) => ({ ...stop, order: index })), // Ensure order is up-to-date
    };

    console.log('TripEditor: Emitting tripSaved event with:', finalTrip);
    this.tripSaved.emit(finalTrip);
  }
}

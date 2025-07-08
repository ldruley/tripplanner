import { Component, input, output, computed, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { DatePickerModule } from 'primeng/datepicker';

import { LocationSearchComponent } from '../location-search/location-search.component';
import { LocationBankComponent } from '../location-bank/location-bank.component';
import { ItineraryBuilderComponent } from '../itinerary-builder/itinerary-builder.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';

import { Location, Trip, Stop } from '@trip-planner/types';
import { MatrixCalculationService } from '../../services/matrix-calculation.service';
import { TripDataService } from '../../services/trip-data.service';

@Component({
  selector: 'app-trip-editor',
  standalone: true,
  imports: [
    FormsModule,
    LocationSearchComponent,
    LocationBankComponent,
    ItineraryBuilderComponent,
    CdkDropListGroup,
    ButtonComponent,
    DatePickerModule
],
  templateUrl: './trip-editor.component.html',
  styleUrls: ['./trip-editor.component.css'],
})
export class TripEditorComponent {
  // Output event when the trip is saved
  readonly tripSaved = output<void>();

  // Inject services
  private tripDataService = inject(TripDataService);
  private matrixService = inject(MatrixCalculationService);

  // Use service signals for reactive state
  currentTrip = this.tripDataService.currentTrip;
  tripId = this.tripDataService.tripId;
  currentTripName = this.tripDataService.tripName;
  currentTripDescription = this.tripDataService.tripDescription;
  bankedLocations = this.tripDataService.bankedLocations;
  itineraryStops = this.tripDataService.itineraryStops;
  isDirty = this.tripDataService.isDirty;
  dataSource = this.tripDataService.dataSource;

  // Computed signal to extract Location objects for the LocationBankComponent
  bankedLocationsList = computed(() => 
    this.bankedLocations()
      .map(banked => banked.location)
      .filter((loc): loc is Location => loc != null)
  );

  // Matrix calculation state
  matrixData = this.matrixService.formattedMatrix;
  isLoadingMatrix = this.matrixService.isLoading;

  // Start date property (not persisted yet)
  startDate: Date | null = null;

  // Helper methods for trip name/description updates
  updateTripName(newName: string): void {
    this.tripDataService.updateTripLocal({ name: newName });
  }

  updateTripDescription(newDescription: string | null): void {
    this.tripDataService.updateTripLocal({ description: newDescription });
  }

  /**
   * Called when a location is selected from the search component.
   * This location is added to the bank.
   */
  onLocationSelectedFromSearch(selectedLocation: Location): void {
    this.tripDataService.addLocationToBank(selectedLocation);
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
    const locationToMove = itemData;

    // Remove from bank and add to itinerary via service
    this.tripDataService.removeLocationFromBank(locationToMove.id);
    this.tripDataService.addStopToItinerary(locationToMove, newIndex);

    console.log(`Moved ${locationToMove.name} from bank to itinerary at index ${newIndex}`);
  }

  /**
   * Called by ItineraryBuilderComponent when stops are reordered within the itinerary.
   */
  handleStopsReordered(reorderedStops: Stop[]): void {
    const reorderedStopIds = reorderedStops.map(stop => stop.id);
    this.tripDataService.reorderStops(reorderedStopIds);
    console.log('TripEditor: Stops reordered.');
  }

  /**
   * Called by ItineraryBuilderComponent when a stop removal is requested.
   */
  handleRemoveStopRequest(stopIdToRemove: string): void {
    this.tripDataService.removeStopFromItinerary(stopIdToRemove);
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
      .map(stop => stop.location)
      .filter((loc): loc is Location => loc != null); // Type guard to filter out nulls

    // 2. Get all locations currently in the bank.
    const bankLocations = this.bankedLocations()
      .map(banked => banked.location)
      .filter((loc): loc is Location => loc != null); // Type guard to filter out nulls

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
   * Emits the save event to trigger backend persistence via the container.
   */
  saveTrip(): void {
    const tripId = this.tripId();
    if (!tripId) {
      console.error('TripEditor: Cannot save trip, ID is missing.');
      return;
    }

    console.log('TripEditor: Emitting tripSaved event');
    this.tripSaved.emit();
  }
}

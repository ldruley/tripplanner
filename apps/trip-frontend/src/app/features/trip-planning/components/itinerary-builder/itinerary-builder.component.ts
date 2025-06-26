import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray } from '@angular/cdk/drag-drop';
import { Location } from '../../models/location.model';
import { Stop } from '../../models/stop.model';
import { ItineraryStopComponent} from '../itinerary-stop/itinerary-stop.component';

export interface TravelSegmentData {
  time: string;
  distance: string;
}
export type MatrixData = Map<string, TravelSegmentData>;

@Component({
  selector: 'app-itinerary-builder',
  standalone: true,
  imports: [
    CommonModule,
    CdkDrag,
    CdkDropList,
    ItineraryStopComponent
  ],
  templateUrl: './itinerary-builder.component.html',
  styleUrl: './itinerary-builder.component.css',
})
export class ItineraryBuilderComponent {

  itineraryStops = input.required<Stop[]>();
  matrixData = input<MatrixData | null>(null);
  listId = input<string>('itinerary-list');
  connectedDropLists = input<string[]>([]);

  readonly stopsReordered = output<Stop[]>(); // Emits the new full list of stops with updated order
  readonly itemDroppedFromOtherList = output<{ itemData: Location, newIndex: number }>(); // Data of item from external list & target index
  readonly removeStopRequested = output<string>(); // Bubbles up stop.id
  readonly editStopRequested = output<string>();   // Bubbles up stop.id

  readonly dropListId = 'itinerary-drop-list';

  constructor() {}

  onDrop(event: CdkDragDrop<Stop[], any, Location | Stop /* Data can be Stop (internal) or Location (from bank) */>): void {
    console.log('ItineraryBuilder: onDrop fired:', event);
    if (event.previousContainer === event.container) {
      // Item was reordered within this itinerary list
      if (event.previousIndex !== event.currentIndex) {
        const newStopsArray = [...this.itineraryStops()]; // Create a mutable copy
        moveItemInArray(newStopsArray, event.previousIndex, event.currentIndex);
        // Update order property for all stops
        const reorderedStops = newStopsArray.map((stop, index) => ({
          ...stop,
          order: index
        }));
        this.stopsReordered.emit(reorderedStops);
      }
    } else {
      // Item was dropped from an external list (e.g., LocationBankComponent)
      // We expect the item.data to be a Location object from the bank
      this.itemDroppedFromOtherList.emit({
        itemData: event.item.data as Location, // Asserting type based on expectation
        newIndex: event.currentIndex
      });
    }
  }

  /**
   * Retrieves travel information to the next stop.
   * stopIndex is the index of the current stop in the itineraryStops array.
   */
  getTravelInfoToNextStop(currentStopIndex: number): TravelSegmentData | null {
    const stops = this.itineraryStops();
    const matrix = this.matrixData();

    if (!matrix || currentStopIndex >= stops.length - 1) {
      return null; // No next stop or no matrix data
    }

    const currentStop = stops[currentStopIndex];
    const nextStop = stops[currentStopIndex + 1];

    if (!currentStop.locationDetails?.id || !nextStop.locationDetails?.id) {
      return null; // Missing location details to form a key
    }

    //const key = `${currentStop.locationDetails.id}_${nextStop.locationDetails.id}`;
    //return matrix.get(key) || null;

    const fromLoc = currentStop.locationDetails;
    const toLoc = nextStop.locationDetails;

    if (!fromLoc || !toLoc) {
      return null;
    }
    const fromCoordKey = `${fromLoc.latitude},${fromLoc.longitude}`;
    const toCoordKey = `${toLoc.latitude},${toLoc.longitude}`;
    const compositeKey = `${fromCoordKey}_${toCoordKey}`;

    const travelData = matrix.get(compositeKey);

    if (!travelData) {
       console.warn(`No matrix data found for key: ${compositeKey}`);
    }
    return travelData || null;
  }

  // --- Bubbling up events from ItineraryStopComponent ---
  handleRemoveStop(stopId: string): void {
    this.removeStopRequested.emit(stopId);
  }

  handleEditStop(stopId: string): void {
    this.editStopRequested.emit(stopId);
  }
}

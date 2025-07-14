import { Component, effect, input, output, signal, computed } from '@angular/core';

import {
  CdkDrag,
  CdkDragStart,
  CdkDropList,
  CdkDragHandle,
  CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { Location } from '@trip-planner/types';
import { LocationDetailsModalComponent } from '../../../shared/components/location-details-modal/location-details-modal.component';

@Component({
  selector: 'app-location-bank',
  standalone: true,
  imports: [CdkDrag, CdkDropList, CdkDragHandle, LocationDetailsModalComponent],
  templateUrl: './location-bank.component.html',
  styleUrl: './location-bank.component.css',
})
export class LocationBankComponent {
  listId = input<string>('bank-list'); // Provide a default value if appropriate
  connectedDropLists = input<string[]>([]);
  bankedLocations = input<Location[]>([]);

  readonly dragStarted = output<Location>();
  readonly addToItinerary = output<Location>();
  readonly itemDroppedFromItinerary = output<{ itemData: any; newIndex: number }>();
  readonly locationRemovedFromBank = output<{ itemData: Location; newIndex: number }>();

  // Modal state
  isModalOpen = signal(false);
  selectedLocation = signal<Location | null>(null);

  // Mobile detection
  isMobile = computed(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  constructor() {
    // Effect removed to reduce debug logging
  }

  onDragStarted(event: CdkDragStart): void {
    // The cdkDrag.data is the Location object for that row
    this.dragStarted.emit(event.source.data);
  }

  onDrop(event: CdkDragDrop<Location[], unknown, any>): void {
    console.log('LocationBank: onDrop fired:', event);
    if (event.previousContainer !== event.container) {
      // Item was dropped from itinerary to bank
      this.itemDroppedFromItinerary.emit({
        itemData: event.item.data,
        newIndex: event.currentIndex,
      });
    }
    // Note: We don't handle internal reordering in the bank
  }

  onViewDetails(location: Location, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.selectedLocation.set(location);
    this.isModalOpen.set(true);
  }

  onCloseModal(): void {
    this.isModalOpen.set(false);
    this.selectedLocation.set(null);
  }

  onAddToItinerary(location: Location, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.addToItinerary.emit(location);
  }

  onLocationRemoved(location: Location, event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.locationRemovedFromBank.emit({ itemData: location, newIndex: -1 });
  }
}

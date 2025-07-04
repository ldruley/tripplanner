import { Component, effect, input, output, signal } from '@angular/core';

import { CdkDrag, CdkDragStart, CdkDropList, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Location } from '../../models/location.model';
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

  // Modal state
  isModalOpen = signal(false);
  selectedLocation = signal<Location | null>(null);

  constructor() {
    effect(() => {
      console.log('LocationBankComponent: bankedLocations input changed:', this.bankedLocations());
    });
  }

  onDragStarted(event: CdkDragStart): void {
    // The cdkDrag.data is the Location object for that row
    this.dragStarted.emit(event.source.data);
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
}

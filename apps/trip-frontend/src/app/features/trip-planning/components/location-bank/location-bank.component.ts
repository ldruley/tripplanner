import { Component, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragStart, CdkDropList } from '@angular/cdk/drag-drop';
import { Location } from '../../models/location.model';

@Component({
  selector: 'app-location-bank',
  standalone: true,
  imports: [
    CommonModule,
    CdkDrag,
    CdkDropList
  ],
  templateUrl: './location-bank.component.html',
  styleUrl: './location-bank.component.css',
})
export class LocationBankComponent {
  listId = input<string>('bank-list'); // Provide a default value if appropriate
  connectedDropLists = input<string[]>([]);
  bankedLocations = input<Location[]>([]);

  readonly dragStarted = output<Location>();

  constructor() {
    effect(() => {
      console.log('LocationBankComponent: bankedLocations input changed:', this.bankedLocations());
    });
  }

  onDragStarted(event: CdkDragStart): void {
    // The cdkDrag.data is the Location object for that row
    this.dragStarted.emit(event.source.data);
  }
}

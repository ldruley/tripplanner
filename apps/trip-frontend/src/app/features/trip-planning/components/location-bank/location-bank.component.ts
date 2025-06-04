import { Component, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
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

  constructor() {
    effect(() => {
      console.log('LocationBankComponent: bankedLocations input changed:', this.bankedLocations());
    });
  }
}

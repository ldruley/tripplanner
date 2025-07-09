import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserFavoriteLocationWithLocation } from '@trip-planner/types';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-location-list-item',
  templateUrl: './location-list-item.component.html',
  styleUrls: ['./location-list-item.component.css'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
})
export class LocationListItemComponent implements OnInit {
  @Input() favoriteLocation!: UserFavoriteLocationWithLocation;
  @Input() showFavoriteButton = true;
  @Input() showDetailsButton = true;
  @Input() compact = false;

  @Output() favoriteToggled = new EventEmitter<UserFavoriteLocationWithLocation>();
  @Output() detailsRequested = new EventEmitter<UserFavoriteLocationWithLocation>();

  displayName = '';
  displayAddress = '';
  displayTags: string[] = [];

  ngOnInit() {
    this.updateDisplayValues();
  }

  private updateDisplayValues() {
    if (!this.favoriteLocation) return;

    const { location, alias, tags } = this.favoriteLocation;

    // Use alias if available, otherwise use location name
    this.displayName = alias || location.name;

    // Build display address
    const addressParts = [location.address, location.city, location.state, location.country].filter(
      Boolean,
    );

    this.displayAddress = addressParts.join(', ');

    // Display tags
    this.displayTags = tags || [];
  }

  onFavoriteToggle() {
    this.favoriteToggled.emit(this.favoriteLocation);
  }

  onDetailsRequested() {
    this.detailsRequested.emit(this.favoriteLocation);
  }

  get hasNotes(): boolean {
    return !!this.favoriteLocation?.notes?.trim();
  }

  get truncatedNotes(): string {
    if (!this.favoriteLocation?.notes) return '';
    const notes = this.favoriteLocation.notes.trim();
    return notes.length > 120 ? notes.substring(0, 120) + '...' : notes;
  }
}

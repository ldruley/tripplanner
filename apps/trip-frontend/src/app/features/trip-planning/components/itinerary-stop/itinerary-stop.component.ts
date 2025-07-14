import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Stop } from '@trip-planner/types';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ButtonComponent } from '../../../shared/components';
import { TripTimezoneService } from '../../services/trip-timezone.service';

// import { TravelSegmentData } from '../../models/matrix.model';

@Component({
  selector: 'app-itinerary-stop',
  standalone: true,
  imports: [CommonModule, CdkDragHandle, ButtonComponent],
  templateUrl: './itinerary-stop.component.html',
  styleUrls: ['./itinerary-stop.component.css'],
})
export class ItineraryStopComponent {
  private readonly tripTimezoneService = inject(TripTimezoneService);

  stop = input.required<Stop>();
  index = input.required<number>();

  readonly removeStop = output<string>();
  readonly editStop = output<string>();
  // readonly viewStopDetails = output<string>();

  // Timezone-aware computed properties
  locationTimezoneDisplayName = computed(() => {
    const location = this.stop().location;
    return location ? this.tripTimezoneService.getLocationTimezoneDisplayName(location) : 'UTC';
  });

  plannedArrivalTimeInLocation = computed(() => {
    const stop = this.stop();
    if (!stop.plannedArrivalTime || !stop.location) return null;

    return this.tripTimezoneService.formatDateTimeWithTimezone(
      stop.plannedArrivalTime,
      stop.location,
      'HH:mm',
      false,
    );
  });

  calculatedArrivalTimeInLocation = computed(() => {
    const stop = this.stop();
    if (!stop.calculatedArrivalTime || !stop.location) return null;

    return this.tripTimezoneService.formatDateTimeWithTimezone(
      stop.calculatedArrivalTime,
      stop.location,
      'HH:mm',
      false,
    );
  });

  calculatedDepartureTimeInLocation = computed(() => {
    const stop = this.stop();
    if (!stop.calculatedDepartureTime || !stop.location) return null;

    return this.tripTimezoneService.formatDateTimeWithTimezone(
      stop.calculatedDepartureTime,
      stop.location,
      'HH:mm',
      false,
    );
  });

  hasTimingInfo = computed(() => {
    const stop = this.stop();
    return !!(
      stop.plannedArrivalTime ||
      stop.calculatedArrivalTime ||
      stop.calculatedDepartureTime
    );
  });

  displayArrivalTime = computed(() => {
    const plannedTime = this.plannedArrivalTimeInLocation();
    const calculatedTime = this.calculatedArrivalTimeInLocation();
    
    if (plannedTime && calculatedTime) {
      return `${plannedTime} (${calculatedTime})`;
    }
    
    return plannedTime || calculatedTime;
  });

  displayDepartureTime = computed(() => {
    return this.calculatedDepartureTimeInLocation();
  });

  onRemoveClicked(): void {
    this.removeStop.emit(this.stop().id);
  }

  onEditClicked(): void {
    this.editStop.emit(this.stop().id);
  }
}

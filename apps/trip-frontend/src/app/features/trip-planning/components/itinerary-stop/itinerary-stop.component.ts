import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Stop } from '@trip-planner/types';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ButtonComponent, LocationTimePipe } from '../../../shared/components';
import { TimezoneTooltipDirective } from '../../../shared/directives';
import { TripTimezoneService } from '../../services/trip-timezone.service';

// import { TravelSegmentData } from '../../models/matrix.model';

@Component({
  selector: 'app-itinerary-stop',
  standalone: true,
  imports: [CommonModule, CdkDragHandle, ButtonComponent, LocationTimePipe, TimezoneTooltipDirective],
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



  hasTimingInfo = computed(() => {
    const stop = this.stop();
    return !!(
      stop.plannedArrivalTime ||
      stop.calculatedArrivalTime ||
      stop.calculatedDepartureTime
    );
  });

  arrivalTimeDisplay = computed(() => {
    const stop = this.stop();

    return {
      planned: stop.plannedArrivalTime,
      calculated: stop.calculatedArrivalTime,
      hasPlanned: !!stop.plannedArrivalTime,
      hasCalculated: !!stop.calculatedArrivalTime,
      hasBoth: !!(stop.plannedArrivalTime && stop.calculatedArrivalTime)
    };
  });

  displayDepartureTime = computed(() => {
    return this.stop().calculatedDepartureTime;
  });

  onRemoveClicked(): void {
    this.removeStop.emit(this.stop().id);
  }

  onEditClicked(): void {
    this.editStop.emit(this.stop().id);
  }
}

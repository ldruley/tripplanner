import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Stop } from '../../models/stop.model';
import { CdkDragHandle } from '@angular/cdk/drag-drop';

// import { TravelSegmentData } from '../../models/matrix.model';

@Component({
  selector: 'app-itinerary-stop',
  standalone: true,
  imports: [CommonModule, CdkDragHandle],
  templateUrl: './itinerary-stop.component.html',
  styleUrls: ['./itinerary-stop.component.css'],
})
export class ItineraryStopComponent {
  stop = input.required<Stop>();
  index = input.required<number>();
  isLast = input<boolean>(false);

  // Input to display time/distance to the NEXT stop
  // This data would be calculated by the parent (ItineraryBuilder or TripEditor)
  // using the matrix routing results.
  travelInfoToNext = input<{ time: string; distance: string } | null>(null);

  readonly removeStop = output<string>();
  readonly editStop = output<string>();
  // readonly viewStopDetails = output<string>();

  onRemoveClicked(): void {
    this.removeStop.emit(this.stop().id);
  }

  onEditClicked(): void {
    this.editStop.emit(this.stop().id);
  }
}

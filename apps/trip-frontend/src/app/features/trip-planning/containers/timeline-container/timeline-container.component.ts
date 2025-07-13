import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripDataService } from '../../services/trip-data.service';
import { TimelineViewComponent } from '../../components/timeline-view/timeline-view.component';

@Component({
  selector: 'app-timeline-container',
  standalone: true,
  imports: [CommonModule, TimelineViewComponent],
  templateUrl: './timeline-container.component.html',
  styleUrl: './timeline-container.component.css'
})
export class TimelineContainerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripDataService = inject(TripDataService);

  // Use service signals for reactive state
  trip = this.tripDataService.currentTrip;
  isLoading = this.tripDataService.isLoading;
  error = this.tripDataService.error;

  // Computed properties
  tripId = computed(() => this.route.snapshot.paramMap.get('tripId'));

  ngOnInit(): void {
    // Get the trip ID from the route
    const id = this.route.snapshot.paramMap.get('tripId');

    if (id) {
      console.log('TimelineContainer: Initializing trip:', id);

      // Initialize trip through service
      this.tripDataService.initializeTrip(id);
    } else {
      console.error('TimelineContainer: No trip ID found');
    }
  }

  // Navigate back to planning view
  navigateToPlanningView(): void {
    const currentTripId = this.tripId();
    if (currentTripId) {
      this.router.navigate(['/trip-planning', currentTripId]);
    }
  }
}

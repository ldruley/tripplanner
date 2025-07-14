import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripDataService } from '../../services/trip-data.service';
import { TripEditViewComponent } from '../../components/trip-edit-view/trip-edit-view.component';
import { TripDetailsViewComponent } from '../../components/trip-details-view/trip-details-view.component';
import { TripTimelineViewComponent } from '../../components/trip-timeline-view/trip-timeline-view.component';

@Component({
  selector: 'app-trip-container',
  standalone: true,
  imports: [
    CommonModule,
    TripEditViewComponent,
    TripDetailsViewComponent,
    TripTimelineViewComponent,
  ],
  templateUrl: './trip-container.component.html',
  styleUrl: './trip-container.component.css',
})
export class TripContainerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripDataService = inject(TripDataService);

  // View state management
  currentView = signal<'planning' | 'timeline'>('planning');
  
  // Mobile side pane state
  isSidePaneOpen = signal<boolean>(false);
  
  // Access trip data for navigation logic
  trip = this.tripDataService.currentTrip;
  
  // Computed properties
  tripId = computed(() => this.route.snapshot.paramMap.get('tripId'));

  ngOnInit(): void {
    // Detect current view based on route
    const urlPath = this.route.snapshot.url.map(segment => segment.path).join('/');
    if (urlPath.endsWith('timeline')) {
      this.currentView.set('timeline');
    } else {
      this.currentView.set('planning');
    }
  }

  // Mobile side pane control methods
  toggleSidePane(): void {
    this.isSidePaneOpen.set(!this.isSidePaneOpen());
  }

  closeSidePane(): void {
    this.isSidePaneOpen.set(false);
  }

  openSidePane(): void {
    this.isSidePaneOpen.set(true);
  }

  // View navigation methods
  navigateToTimeline(): void {
    const currentTripId = this.tripId();
    if (currentTripId && currentTripId !== 'new') {
      this.router.navigate(['/trip-planning', currentTripId, 'timeline']);
    }
  }

  navigateToPlanningView(): void {
    const currentTripId = this.tripId();
    if (currentTripId && currentTripId !== 'new') {
      this.router.navigate(['/trip-planning', currentTripId]);
    }
  }
}
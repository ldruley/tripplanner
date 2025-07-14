import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TripDataService } from '../../services/trip-data.service';
import { ToastService } from '../../../shared/services';
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
  private toastService = inject(ToastService);

  // View state management
  currentView = signal<'planning' | 'timeline'>('planning');
  
  // Mobile side pane state
  isSidePaneOpen = signal<boolean>(false);
  
  // Access trip data for navigation logic
  trip = this.tripDataService.currentTrip;
  
  // Computed properties
  tripId = computed(() => this.route.snapshot.paramMap.get('tripId'));

  ngOnInit(): void {
    // Check if this is a new trip route - redirect timeline to planning
    const urlSegments = this.route.snapshot.url.map(segment => segment.path);
    const isNewTrip = urlSegments.includes('new');
    const isTimelineRoute = urlSegments.includes('timeline');
    
    if (isNewTrip && isTimelineRoute) {
      // Redirect new trips from timeline to planning view
      this.router.navigate(['/trip-planning', 'new']);
      return;
    }

    // Detect current view based on route
    const urlPath = this.route.snapshot.url.map(segment => segment.path).join('/');
    if (urlPath.endsWith('timeline')) {
      this.currentView.set('timeline');
    } else {
      this.currentView.set('planning');
    }

    // Initialize trip data
    let tripId: string;

    if (isNewTrip) {
      tripId = 'new';
    } else {
      // Try to get the tripId parameter for existing trips
      const id = this.route.snapshot.paramMap.get('tripId');
      if (id) {
        tripId = id;
      } else {
        console.error('TripContainer: No trip ID found and not a new trip');
        return;
      }
    }

    console.log('TripContainer: Initializing trip:', tripId);

    // Initialize trip through service
    this.tripDataService.initializeTrip(tripId);
    
    // Show appropriate toast based on data source after initialization
    this.showInitializationToast(tripId);
  }

  private showInitializationToast(tripId: string): void {
    // Wait for initialization to complete before showing toast
    setTimeout(() => {
      const dataSource = this.tripDataService.dataSource();
      const tripName = this.tripDataService.tripName();

      switch (dataSource) {
        case 'new':
          this.toastService.showInfo('New trip', 'Started creating a new trip');
          break;
        case 'draft':
          this.toastService.showInfo('Draft loaded', `Loaded draft: ${tripName}`);
          break;
        case 'persisted':
          this.toastService.showInfo('Trip loaded', `Loaded trip: ${tripName}`);
          break;
      }
    }, 100);
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
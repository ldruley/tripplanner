import { Component, inject, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TripFacade } from '../../../../domains/trips';
import { ToastService } from '../../../shared/services';
import { TripEditViewComponent } from '../../components/trip-edit-view/trip-edit-view.component';
import { TripDetailsViewComponent } from '../../components/trip-details-view/trip-details-view.component';
import { TripTimelineViewComponent } from '../../components/trip-timeline-view/trip-timeline-view.component';
import { TripMapViewComponent } from '../../components/trip-map-view/trip-map-view.component';

@Component({
  selector: 'app-trip-container',
  standalone: true,
  imports: [
    CommonModule,
    TripEditViewComponent,
    TripDetailsViewComponent,
    TripTimelineViewComponent,
    TripMapViewComponent,
  ],
  templateUrl: './trip-container.component.html',
  styleUrl: './trip-container.component.css',
})
export class TripContainerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripFacade = inject(TripFacade);
  private toastService = inject(ToastService);

  // Subscriptions
  private routeSubscription?: Subscription;

  // View state management
  currentView = signal<'planning' | 'timeline' | 'map'>('planning');

  // Mobile side pane state
  isSidePaneOpen = signal<boolean>(false);

  // Access trip data for navigation logic
  trip = this.tripFacade.currentTrip;

  // Current trip ID from route
  currentTripId = signal<string | null>(null);

  ngOnInit(): void {
    console.log('TripContainer: ngOnInit called');
    // Subscribe to route parameter changes to handle navigation between trip IDs
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const tripId = params.get('tripId') || 'new';
      console.log('TripContainer: Route params changed, tripId:', tripId);
      
      this.currentTripId.set(tripId);
      this.updateCurrentView();
      this.initializeTripData(tripId);
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  private updateCurrentView(): void {
    const urlPath = this.route.snapshot.url.map(segment => segment.path).join('/');
    if (urlPath.endsWith('timeline')) {
      this.currentView.set('timeline');
    } else if (urlPath.endsWith('map')) {
      this.currentView.set('map');
    } else {
      this.currentView.set('planning');
    }
  }

  private initializeTripData(tripId: string): void {
    // Check if this is a new trip route with timeline - redirect to planning
    const urlSegments = this.route.snapshot.url.map(segment => segment.path);
    const isNewTrip = tripId === 'new';
    const isTimelineRoute = urlSegments.includes('timeline');

    if (isNewTrip && isTimelineRoute) {
      // Redirect new trips from timeline to planning view
      this.router.navigate(['/trip-planning', 'new']);
      return;
    }

    // Check if we're already working with the same trip to avoid unnecessary re-initialization
    const currentTrip = this.tripFacade.currentTrip();
    const currentTripId = currentTrip?.id;
    const currentDataSource = this.tripFacade.dataSource();
    
    // For new trips, check if we already have a new trip loaded
    // For existing trips, check if the ID matches
    const shouldInitialize = tripId === 'new' 
      ? currentDataSource !== 'draft' || !currentTrip
      : currentTripId !== tripId || !currentTrip;
    
    if (shouldInitialize) {
      console.log('TripContainer: Initializing trip:', tripId);
      
      if (tripId === 'new') {
        // Start a new draft trip
        this.tripFacade.startNewDraftTrip('New Trip', 'Plan your perfect trip');
        this.showInitializationToast(tripId);
      } else {
        // Load existing trip
        this.tripFacade.loadTrip(tripId).subscribe({
          next: (trip) => {
            if (trip) {
              this.showInitializationToast(tripId);
            } else {
              this.toastService.showError('Trip not found', 'The requested trip could not be loaded');
              this.router.navigate(['/trip-planning', 'new']);
            }
          },
          error: (error) => {
            console.error('TripContainer: Failed to load trip:', error);
            this.toastService.showError('Load failed', 'Failed to load trip');
            this.router.navigate(['/trip-planning', 'new']);
          }
        });
      }
    } else {
      console.log('TripContainer: Same trip already loaded, skipping initialization');
    }
  }

  private showInitializationToast(tripId: string): void {
    // Wait for initialization to complete before showing toast
    setTimeout(() => {
      const dataSource = this.tripFacade.dataSource();
      const tripName = this.tripFacade.tripName();

      switch (dataSource) {
        case 'draft':
          if (tripId === 'new') {
            this.toastService.showInfo('New trip', 'Started creating a new trip');
          } else {
            this.toastService.showInfo('Draft loaded', `Loaded draft: ${tripName}`);
          }
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
    const tripId = this.currentTripId();
    if (tripId && tripId !== 'new') {
      this.router.navigate(['/trip-planning', tripId, 'timeline']);
    }
  }

  navigateToPlanningView(): void {
    const tripId = this.currentTripId();
    if (tripId && tripId !== 'new') {
      this.router.navigate(['/trip-planning', tripId]);
    }
  }

  navigateToMapView(): void {
    const tripId = this.currentTripId();
    if (tripId && tripId !== 'new') {
      this.router.navigate(['/trip-planning', tripId, 'map']);
    }
  }
}

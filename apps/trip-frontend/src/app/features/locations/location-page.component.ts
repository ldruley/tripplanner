import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location, UserFavoriteLocation, UpdateUserFavoriteLocation } from '@trip-planner/types';
import { LocationService } from '../shared/services/location.service';
import { LocationSearchComponent } from '../shared/components/location-search/location-search.component';
import { LocationListItemComponent } from '../shared/components/location-list-item/location-list-item.component';
import { LocationDetailsComponent } from '../shared/components/location-details/location-details.component';
import { ToastService } from '../shared/services/toast.service';
import { LoadingSpinnerComponent } from '../shared/components/loading-spinner/loading-spinner.component';
import { catchError, of, finalize } from 'rxjs';

@Component({
  selector: 'app-location-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    LocationSearchComponent,
    LocationListItemComponent,
    LocationDetailsComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './location-page.component.html',
  styleUrls: ['./location-page.component.css'],
})
export class LocationPageComponent implements OnInit {
  // State signals
  favorites = signal<UserFavoriteLocation[]>([]);
  isLoading = signal<boolean>(false);
  selectedLocation = signal<UserFavoriteLocation | null>(null);
  isDetailModalOpen = signal<boolean>(false);

  constructor(
    private locationService: LocationService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadFavorites();
  }

  private loadFavorites() {
    this.isLoading.set(true);
    this.locationService
      .getUserFavorites()
      .pipe(
        catchError(error => {
          console.error('Error loading favorites:', error);
          this.toastService.error('Failed to load favorite locations');
          return of([]);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe(favorites => {
        this.favorites.set(favorites);
      });
  }

  onLocationSelectedFromSearch(location: Location) {
    // Location is already created by backend, add to favorites directly
    this.locationService
      .addToFavorites(location.id)
      .pipe(
        catchError(error => {
          console.error('Error adding location to favorites:', error);
          if (error.status === 409) {
            this.toastService.error('Location is already in your favorites');
          } else {
            this.toastService.error('Failed to add location to favorites');
          }
          return of(null);
        }),
      )
      .subscribe(favorite => {
        if (favorite) {
          this.toastService.success('Location added to favorites');
          this.loadFavorites(); // Refresh the list
        }
      });
  }

  onFavoriteToggle(favoriteLocation: UserFavoriteLocation) {
    // Show confirmation dialog
    const locationName = favoriteLocation.alias || favoriteLocation.location.name;
    if (confirm(`Remove "${locationName}" from your favorites?`)) {
      this.removeFavorite(favoriteLocation);
    }
  }

  private removeFavorite(favoriteLocation: UserFavoriteLocation) {
    this.locationService
      .removeFromFavorites(favoriteLocation.locationId)
      .pipe(
        catchError(error => {
          console.error('Error removing favorite:', error);
          this.toastService.error('Failed to remove location from favorites');
          return of(null);
        }),
      )
      .subscribe(() => {
        this.toastService.success('Location removed from favorites');
        this.loadFavorites(); // Refresh the list
      });
  }

  onDetailsRequested(favoriteLocation: UserFavoriteLocation) {
    this.selectedLocation.set(favoriteLocation);
    this.isDetailModalOpen.set(true);
  }

  onDetailModalClose() {
    this.isDetailModalOpen.set(false);
    this.selectedLocation.set(null);
  }

  onFavoriteToggleFromDetails(event: { locationId: string; isFavorite: boolean }) {
    if (!event.isFavorite) {
      const favorite = this.favorites().find(f => f.locationId === event.locationId);
      if (favorite) {
        this.removeFavorite(favorite);
        this.onDetailModalClose();
      }
    }
  }

  onMetadataUpdated(event: { locationId: string; metadata: UpdateUserFavoriteLocation }) {
    this.locationService
      .updateFavoriteMetadata(event.locationId, event.metadata)
      .pipe(
        catchError(error => {
          console.error('Error updating favorite metadata:', error);
          this.toastService.error('Failed to update location details');
          return of(null);
        }),
      )
      .subscribe(updatedFavorite => {
        if (updatedFavorite) {
          this.toastService.success('Location details updated');
          this.loadFavorites(); // Refresh the list
          this.selectedLocation.set(updatedFavorite); // Update the selected location
        }
      });
  }

  onNavigateToTrips() {
    this.router.navigate(['/trips']);
  }

  get hasFavorites(): boolean {
    return this.favorites().length > 0;
  }

  get selectedFavoriteLocation(): UserFavoriteLocation | null {
    return this.selectedLocation();
  }
}

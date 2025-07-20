import { Component, inject, computed, Input, OnInit, signal, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TripFacade } from '../../../../domains/trips';
import { LocationFacade } from '../../../../domains/locations';
import { LocationService } from '../../../shared/services/location.service';
import { ToastService } from '../../../shared/services/toast.service';
import { DropdownComponent, DropdownItem } from '../../../shared/components/dropdown/dropdown.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { UserFavoriteLocation } from '@trip-planner/types';

@Component({
  selector: 'app-trip-details-view',
  standalone: true,
  imports: [
    CommonModule,
    ConfirmPopupModule,
    DropdownComponent,
    ButtonComponent,
  ],
  templateUrl: './trip-details-view.component.html',
  styleUrl: './trip-details-view.component.css',
  providers: [ConfirmationService, MessageService],
})
export class TripDetailsViewComponent implements OnInit {
  @Input() currentView: 'planning' | 'timeline' | 'map' = 'planning';
  private tripFacade = inject(TripFacade);
  private locationFacade = inject(LocationFacade);
  private locationService = inject(LocationService);
  private toastService = inject(ToastService);
  private confirmationService = inject(ConfirmationService);
  private elementRef = inject(ElementRef);

  // Access trip data through facade signals
  trip = this.tripFacade.currentTrip;
  isLoading = this.tripFacade.isLoading;
  error = this.tripFacade.error;
  
  // Computed properties for trip details
  tripName = computed(() => this.trip()?.name || 'Untitled Trip');
  tripDescription = computed(() => this.trip()?.description || '');
  stopCount = computed(() => this.trip()?.stops?.length || 0);
  
  // Favorites state
  favorites = signal<UserFavoriteLocation[]>([]);
  favoritesLoading = signal(false);
  favoritesError = signal<string | null>(null);
  
  // Dropdown state
  isDropdownOpen = signal(false);
  dropdownTriggerElement: HTMLElement | null = null;
  
  // Computed dropdown items
  favoriteDropdownItems = computed(() => {
    return this.favorites().map(favorite => ({
      id: favorite.id,
      label: favorite.alias || favorite.location.name,
      icon: 'pi pi-heart-fill',
      action: () => this.selectFavoriteLocation(favorite),
      disabled: false,
    }));
  });

  ngOnInit(): void {
    this.loadFavorites();
  }
  
  private async loadFavorites(): Promise<void> {
    if (this.currentView !== 'planning') return;
    
    this.favoritesLoading.set(true);
    this.favoritesError.set(null);
    
    try {
      await this.locationService.getUserFavorites().toPromise();
      this.favorites.set(this.locationService.favoritesSignal());
    } catch (error) {
      console.error('Failed to load favorites:', error);
      this.favoritesError.set('Failed to load favorite locations');
    } finally {
      this.favoritesLoading.set(false);
    }
  }

  onAddFavoriteClick(event: Event): void {
    const target = event.target as HTMLElement;
    this.dropdownTriggerElement = target.closest('button');
    this.isDropdownOpen.set(true);
  }

  onCloseDropdown(): void {
    this.isDropdownOpen.set(false);
    this.dropdownTriggerElement = null;
  }

  selectFavoriteLocation(favorite: UserFavoriteLocation): void {
    const target = this.dropdownTriggerElement;
    if (!target) return;

    this.confirmationService.confirm({
      target: target,
      message: `Add "${favorite.alias || favorite.location.name}" to your location bank?`,
      header: 'Add to Trip',
      icon: 'pi pi-question-circle',
      acceptButtonStyleClass: 'p-button-text p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-text p-button-secondary',
      accept: () => this.addFavoriteToBank(favorite),
    });
  }

  private addFavoriteToBank(favorite: UserFavoriteLocation): void {
    const currentTrip = this.trip();
    if (!currentTrip) {
      this.toastService.showError('No trip selected');
      return;
    }

    const tripId = this.tripFacade.tripId();
    if (!tripId || tripId === 'new') {
      this.toastService.showError('Trip must be saved before adding locations');
      return;
    }

    // Use trip facade to add location to bank through command pattern
    this.tripFacade.addBankedLocation(tripId, favorite.location)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.toastService.showSuccess(`Added "${favorite.alias || favorite.location.name}" to location bank`);
        },
        error: (error) => {
          console.error('Failed to add location to bank:', error);
          this.toastService.showError('Failed to add location to trip');
        }
      });
  }
  
  // Placeholder methods for future functionality
  onEditTripDetails(): void {
    console.log('Edit trip details clicked');
    // TODO: Implement trip details editing
  }

  onTripSettings(): void {
    console.log('Trip settings clicked');
    // TODO: Implement trip settings
  }

  onExportTrip(): void {
    console.log('Export trip clicked');
    // TODO: Implement trip export
  }

  onShareTrip(): void {
    console.log('Share trip clicked');
    // TODO: Implement trip sharing
  }
}
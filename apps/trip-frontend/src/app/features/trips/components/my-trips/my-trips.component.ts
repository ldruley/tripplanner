import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Trip } from '@trip-planner/types';
import { TripsService } from '../../../shared/services/trips.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { ToastService } from '../../../shared/services/toast.service';
import { catchError, finalize, of } from 'rxjs';

@Component({
  selector: 'app-my-trips',
  standalone: true,
  imports: [CommonModule, ButtonComponent, LoadingSpinnerComponent],
  templateUrl: './my-trips.component.html',
  styleUrl: './my-trips.component.css',
})
export class MyTripsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tripsService = inject(TripsService);
  private readonly toastService = inject(ToastService);

  // State management
  private readonly _trips = signal<Trip[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Public readonly signals
  readonly trips = this._trips.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  // Computed properties
  readonly hasTrips = computed(() => this.trips().length > 0);
  readonly isEmpty = computed(() => !this.loading() && !this.hasTrips());

  ngOnInit(): void {
    this.loadTrips();
  }

  private loadTrips(): void {
    this._loading.set(true);
    this._error.set(null);

    this.tripsService
      .getTrips()
      .pipe(
        catchError(error => {
          console.error('Failed to load trips:', error);
          this._error.set('Failed to load trips. Please try again.');
          this.toastService.showError('Error', 'Failed to load trips. Please try again.');
          return of([]);
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe(trips => {
        this._trips.set(trips);
      });
  }

  onCreateNewTrip(): void {
    this.router.navigate(['/trip-planning/new']);
  }

  onViewTrip(tripId: string): void {
    // For now, navigate to trip planning page
    // In the future, this will link to the timeline view
    this.router.navigate(['/trip-planning', tripId]);
  }

  onDeleteTrip(tripId: string, tripName: string): void {
    if (!confirm(`Are you sure you want to delete "${tripName}"? This action cannot be undone.`)) {
      return;
    }

    this.tripsService
      .deleteTrip(tripId)
      .pipe(
        catchError(error => {
          console.error('Failed to delete trip:', error);
          this.toastService.showError('Error', 'Failed to delete trip. Please try again.');
          return of(null);
        }),
      )
      .subscribe(result => {
        if (result) {
          this.toastService.showSuccess('Success', 'Trip deleted successfully.');
          this.loadTrips(); // Refresh the list
        }
      });
  }

  onRefresh(): void {
    this.loadTrips();
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'No date set';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateRange(
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
  ): string {
    if (!startDate && !endDate) return 'Dates not set';
    if (!startDate) return `Ends ${this.formatDate(endDate)}`;
    if (!endDate) return `Starts ${this.formatDate(startDate)}`;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.getTime() === end.getTime()) {
      return this.formatDate(startDate);
    }

    return `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
  }

  getStopCount(trip: Trip): number {
    return trip.stops?.length || 0;
  }
}

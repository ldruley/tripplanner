import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripDataService } from '../../services/trip-data.service';
import { TripTimezoneService } from '../../services/trip-timezone.service';
import { TimezoneIndicatorComponent } from '../../../shared/components/timezone-indicator/timezone-indicator.component';

@Component({
  selector: 'app-trip-summary',
  standalone: true,
  imports: [CommonModule, TimezoneIndicatorComponent],
  template: `
    @if (tripDataService.hasTrip()) {
      <div class="bg-tp-bg-light-primary dark:bg-tp-bg-secondary rounded-lg border border-tp-border-light dark:border-tp-border p-4 space-y-3">
        <h3 class="text-lg font-semibold text-tp-text-light-primary dark:text-tp-text-primary">
          Trip Summary
        </h3>
        
        <!-- Trip Duration -->
        @if (formattedTripDuration()) {
          <div class="flex items-center justify-between">
            <span class="text-sm text-tp-text-light-secondary dark:text-tp-text-secondary">
              Total Duration:
            </span>
            <span class="text-sm font-medium text-tp-text-light-primary dark:text-tp-text-primary">
              {{ formattedTripDuration() }}
            </span>
          </div>
        }
        
        <!-- Trip Dates -->
        @if (tripDataService.formattedTripStartDate()) {
          <div class="flex items-center justify-between">
            <span class="text-sm text-tp-text-light-secondary dark:text-tp-text-secondary">
              Start Date:
            </span>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-tp-text-light-primary dark:text-tp-text-primary">
                {{ formatTripDate(tripDataService.formattedTripStartDate()!) }}
              </span>
              <app-timezone-indicator 
                [timezone]="tripDataService.tripPrimaryTimezone()" 
                variant="subtle" 
                size="sm" />
            </div>
          </div>
        }
        
        @if (tripDataService.formattedTripEndDate()) {
          <div class="flex items-center justify-between">
            <span class="text-sm text-tp-text-light-secondary dark:text-tp-text-secondary">
              End Date:
            </span>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-tp-text-light-primary dark:text-tp-text-primary">
                {{ formatTripDate(tripDataService.formattedTripEndDate()!) }}
              </span>
              <app-timezone-indicator 
                [timezone]="tripDataService.tripPrimaryTimezone()" 
                variant="subtle" 
                size="sm" />
            </div>
          </div>
        }
        
        <!-- Stop Count -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-tp-text-light-secondary dark:text-tp-text-secondary">
            Total Stops:
          </span>
          <span class="text-sm font-medium text-tp-text-light-primary dark:text-tp-text-primary">
            {{ tripDataService.itineraryStops().length }}
          </span>
        </div>
        
        <!-- Scheduled Stops -->
        @if (tripDataService.hasScheduledStops()) {
          <div class="flex items-center justify-between">
            <span class="text-sm text-tp-text-light-secondary dark:text-tp-text-secondary">
              Scheduled Stops:
            </span>
            <span class="text-sm font-medium text-green-600 dark:text-green-400">
              {{ scheduledStopsCount() }}
            </span>
          </div>
        }
        
        <!-- Multi-timezone Warning -->
        @if (isMultiTimezoneTrip()) {
          <div class="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <div class="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
              <span>This trip spans multiple time zones. Check arrival times carefully.</span>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class TripSummaryComponent {
  tripDataService = inject(TripDataService);
  private readonly tripTimezoneService = inject(TripTimezoneService);

  // Computed properties
  readonly formattedTripDuration = computed(() => {
    const duration = this.tripDataService.tripDurationInTimezone();
    if (!duration) return null;
    
    const hours = Math.floor(duration.duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration.duration % (1000 * 60 * 60)) / (1000 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}d ${remainingHours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  });

  readonly scheduledStopsCount = computed(() => {
    return this.tripDataService.sortedStops().filter(stop => stop.plannedArrivalTime).length;
  });

  readonly isMultiTimezoneTrip = computed(() => {
    const trip = this.tripDataService.currentTrip();
    return this.tripTimezoneService.isMultiTimezoneTrip(trip);
  });

  formatTripDate(dateTime: any): string {
    if (!dateTime) return '';
    
    // If it's already a Luxon DateTime
    if (dateTime.toFormat) {
      return dateTime.toFormat('MMM dd, yyyy');
    }
    
    // If it's a Date object, convert it
    const trip = this.tripDataService.currentTrip();
    const primaryTimezone = this.tripTimezoneService.getTripPrimaryTimezone(trip);
    const luxonDate = this.tripTimezoneService.convertDateToLocationTimezone(dateTime, { timezone: primaryTimezone });
    return luxonDate.toFormat('MMM dd, yyyy');
  }
}
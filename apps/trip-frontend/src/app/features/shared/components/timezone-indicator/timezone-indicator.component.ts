import { Component, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@trip-planner/types';
import { TripTimezoneService } from '../../../features/trip-planning/services/trip-timezone.service';

@Component({
  selector: 'app-timezone-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (showTimezone()) {
      <div class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
           [class]="containerClass()">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{{ timezoneDisplayName() }}</span>
      </div>
    }
  `,
})
export class TimezoneIndicatorComponent {
  private readonly tripTimezoneService = inject(TripTimezoneService);
  
  // Inputs
  location = input<Location | null>(null);
  timezone = input<string | null>(null);
  variant = input<'default' | 'subtle' | 'primary'>('default');
  size = input<'sm' | 'md'>('sm');

  // Computed properties
  readonly actualTimezone = computed(() => {
    return this.timezone() || this.location()?.timezone || 'UTC';
  });

  readonly timezoneDisplayName = computed(() => {
    const location = this.location();
    const timezone = this.timezone();
    
    if (location) {
      return this.tripTimezoneService.getLocationTimezoneDisplayName(location);
    } else if (timezone) {
      return this.tripTimezoneService.getLocationTimezoneDisplayName({ timezone } as Location);
    }
    
    return 'UTC';
  });

  readonly showTimezone = computed(() => {
    return this.actualTimezone() !== 'UTC';
  });

  readonly containerClass = computed(() => {
    const variant = this.variant();
    const size = this.size();
    
    let classes = '';
    
    // Size classes
    if (size === 'sm') {
      classes += 'text-xs px-2 py-1 ';
    } else {
      classes += 'text-sm px-3 py-1.5 ';
    }
    
    // Variant classes
    switch (variant) {
      case 'primary':
        classes += 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
        break;
      case 'subtle':
        classes += 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400';
        break;
      default:
        classes += 'bg-tp-bg-light-secondary dark:bg-tp-bg-secondary text-tp-text-light-secondary dark:text-tp-text-secondary';
        break;
    }
    
    return classes;
  });
}
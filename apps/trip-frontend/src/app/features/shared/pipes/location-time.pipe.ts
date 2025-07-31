import { Pipe, PipeTransform } from '@angular/core';
import { Location } from '@trip-planner/types';
import { formatDateInLocationTimezone } from '@trip-planner/date-utils';

@Pipe({
  name: 'locationTime',
  standalone: true,
})
export class LocationTimePipe implements PipeTransform {
  transform(date: Date | null | undefined, location: Location | null | undefined): string {
    if (!date || !location) {
      return '--';
    }

    try {
      return formatDateInLocationTimezone(date, location, 'MMM d, h:mm a', false);
    } catch (error) {
      console.warn('LocationTimePipe: Error formatting date', error);
      return '--';
    }
  }
}

import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../../settings/services/settings.service';
import { convertDateToTimezone } from '@trip-planner/date-utils';
import { DateTime } from 'luxon';

@Pipe({
  name: 'userTime',
  standalone: true,
})
export class UserTimePipe implements PipeTransform {
  private readonly settingsService = inject(SettingsService);

  transform(date: Date | null | undefined): string {
    if (!date) {
      return '--';
    }

    try {
      const settings = this.settingsService.state$().settings;
      const userTimezone = settings?.timezone || 'UTC';

      const dt = DateTime.fromJSDate(date, { zone: 'UTC' });
      const userTime = dt.setZone(userTimezone);

      return userTime.toFormat('MMM d, h:mm a');
    } catch (error) {
      console.warn('UserTimePipe: Error formatting date', error);
      return '--';
    }
  }
}

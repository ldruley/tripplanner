import { Pipe, PipeTransform, inject } from '@angular/core';
import { DistanceUnit } from '@prisma/client';
import { SettingsService } from '../../settings/services/settings.service';

@Pipe({
  name: 'distance',
  standalone: true,
})
export class DistancePipe implements PipeTransform {
  private readonly settingsService = inject(SettingsService);

  transform(distanceInKm: number | null | undefined): string {
    if (distanceInKm == null || isNaN(distanceInKm)) {
      return '--';
    }

    const settings = this.settingsService.state$().settings;
    const distanceUnit = settings?.distanceUnit || DistanceUnit.KILOMETERS;

    if (distanceUnit === DistanceUnit.MILES) {
      const distanceInMiles = distanceInKm * 0.621371;
      return `${distanceInMiles.toFixed(1)} mi`;
    }

    return `${distanceInKm.toFixed(1)} km`;
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { getTimeZones } from '@vvo/tzdb';

//TODO: Move or refactor this in a shared library and pick the timezones better
const MAJOR_CITY_TIMEZONES = [
  'Etc/GMT+12',
  'Pacific/Pago_Pago',
  'Pacific/Honolulu',
  'Pacific/Marquesas',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Santiago',
  'America/St_Johns',
  'America/Sao_Paulo',
  'America/Noronha',
  'Atlantic/Azores',
  'Europe/London',
  'Europe/Paris',
  'Europe/Bucharest',
  'Europe/Moscow',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Kabul',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Dhaka',
  'Asia/Yangon',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Australia/Eucla',
  'Asia/Tokyo',
  'Australia/Darwin',
  'Australia/Sydney',
  'Australia/Lord_Howe',
  'Pacific/Guadalcanal',
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Tongatapu',
  'Pacific/Kiritimati',
];

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `GMT${sign}${hours}:${mins}`;
}

@Component({
  standalone: true,
  selector: 'app-settings-form',
  templateUrl: './settings-form.component.html',
  styleUrl: 'settings-form.component.css',
  imports: [ButtonComponent, ReactiveFormsModule],
})
export class SettingsFormComponent {
  readonly timezones = getTimeZones()
    .filter(tz => MAJOR_CITY_TIMEZONES.includes(tz.name))
    .map(tz => {
      const offset = formatOffset(tz.currentTimeOffsetInMinutes);
      const labelDetail = tz.alternativeName || tz.mainCities?.[0] || tz.name;
      return {
        label: `(${offset}) ${labelDetail}`,
        value: tz.name,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  @Input() form!: FormGroup;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() saveRequested = new EventEmitter<void>();
  @Output() cancelRequested = new EventEmitter<void>();

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSave(): void {
    if (this.form.valid) {
      this.saveRequested.emit();
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.cancelRequested.emit();
  }
}

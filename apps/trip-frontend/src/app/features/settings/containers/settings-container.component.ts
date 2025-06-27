import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { z } from 'zod';
import { buildSettingsForm } from '../../../core/forms/form-factory';
import { SettingsFormComponent } from '../components/settings-form.component';
import { SettingsService } from '../services/settings.service';
import { UserSettingsSchema } from '@trip-planner/types';

@Component({
  standalone: true,
  selector: 'app-settings-container',
  templateUrl: './settings-container.component.html',
  imports: [SettingsFormComponent],
})
export class SettingsContainerComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  form = buildSettingsForm(this.fb);

  private _loading = signal(true);
  private _error = signal<string | null>(null);
  private _toastMessage = signal<string | null>(null);

  readonly vm = computed(() => ({
    loading: this._loading(),
    error: this._error(),
    toastMessage: this._toastMessage(),
    form: this.form,
  }));

  constructor() {
    this.load();
  }

  load() {
    this._loading.set(true);
    this.settingsService.getUserSettings().subscribe({
      next: (settings) => {
        this.form.patchValue(settings);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set('Failed to load settings.');
        this._loading.set(false);
      },
    });
  }

  onSave() {
    const raw = this.form.getRawValue();
    const result = UserSettingsSchema.safeParse(raw);
    if (!result.success) {
      this.mapZodErrorsToForm(result.error);
      return;
    }

    this._loading.set(true);
    this.settingsService.updateUserSettings(result.data).subscribe({
      next: () => {
        this._toastMessage.set('Settings saved!');
        this._loading.set(false);
      },
      error: () => {
        this._error.set('Could not save settings');
        this._loading.set(false);
      },
    });
  }

  private mapZodErrorsToForm(error: z.ZodError) {
    const fieldErrors = error.flatten().fieldErrors;
    for (const key in fieldErrors) {
      const control = this.form.get(key);
      if (control && fieldErrors[key] && fieldErrors[key][0]) {
        control.setErrors({ zod: fieldErrors[key][0] });
      }
    }
  }

  onCancel() {
    this.load();
  }

  clearToast() {
    this._toastMessage.set(null);
  }
}

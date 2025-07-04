import { Component, computed, effect, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { z } from 'zod';
import { buildSettingsForm } from '../../../core/forms/form-factory';
import { SettingsFormComponent } from '../components/settings-form.component';
import { SettingsService } from '../services/settings.service';
import { ToastService } from '../../shared/services';
import { UpdateUserSettingsSchema } from '@trip-planner/types';

@Component({
  standalone: true,
  selector: 'app-settings-container',
  templateUrl: './settings-container.component.html',
  styleUrl: './settings-container.component.css',
  imports: [SettingsFormComponent],
})
export class SettingsContainerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly toastService = inject(ToastService);

  public readonly form = buildSettingsForm(this.fb);

  // Get service state
  private readonly serviceState = this.settingsService.state$;

  // Enhanced view model that includes form
  readonly vm = computed(() => ({
    loading: this.serviceState().loading,
    error: this.serviceState().error,
    settings: this.serviceState().settings,
    form: this.form,
  }));

  constructor() {
    this.load();

    effect(() => {
      const state = this.serviceState();

      if (state.settings && !state.loading) {
        // Patch form when settings are loaded
        console.log('Patching form with settings:', state.settings);
        // Use setTimeout to ensure form is ready
        setTimeout(() => {
          this.form.patchValue(state.settings!);
          this.form.markAsPristine(); // Mark as pristine after loading
        });
      }
    });
  }

  load(): void {
    this.settingsService.loadSettings();
  }

  onSave(): void {
    const raw = this.form.getRawValue();
    const result = UpdateUserSettingsSchema.safeParse(raw);

    if (!result.success) {
      this.mapZodErrorsToForm(result.error);
      console.log('zod validation failed', result.error);
      console.log('form errors', raw);
      return;
    }

    this.settingsService.updateSettings(result.data);
    this.toastService.showSuccess(
      'Settings saved!',
      'Your preferences have been successfully updated.',
    );
  }

  onCancel(): void {
    this.load();
  }

  private mapZodErrorsToForm(error: z.ZodError): void {
    const fieldErrors = error.flatten().fieldErrors;
    for (const key in fieldErrors) {
      const control = this.form.get(key);
      if (control && fieldErrors[key] && fieldErrors[key][0]) {
        control.setErrors({ zod: fieldErrors[key][0] });
      }
    }
  }
}

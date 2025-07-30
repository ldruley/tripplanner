import { Component, input, output, computed, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ToastService } from '../../../shared/services';
import { TripFacade } from '../../../../domains/trips';
import { Stop, UpdateStopRequest } from '@trip-planner/types';
import { StopType } from '@prisma/client';
import { TripTimezoneService } from '../../services/trip-timezone.service';
import { DateTime } from 'luxon';

interface StopTypeOption {
  label: string;
  value: StopType;
}

@Component({
  selector: 'app-stop-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePickerModule, SelectModule, ButtonComponent],
  templateUrl: './stop-edit-modal.component.html',
  styleUrls: ['./stop-edit-modal.component.css'],
})
export class StopEditModalComponent implements OnInit {
  // Inputs
  stop = input.required<Stop>();
  isOpen = input<boolean>(false);

  // Outputs
  closeModal = output<void>();
  stopUpdated = output<Stop>();

  // Injected services
  private readonly formBuilder = inject(FormBuilder);
  private readonly tripFacade = inject(TripFacade);
  private toastService = inject(ToastService);
  private readonly tripTimezoneService = inject(TripTimezoneService);
  private readonly destroyRef = inject(DestroyRef);

  // Component state
  stopForm!: FormGroup;
  isLoading = signal<boolean>(false);

  // Stop type options
  stopTypeOptions: StopTypeOption[] = [
    { label: 'Pitstop', value: StopType.PITSTOP },
    { label: 'Overnight', value: StopType.OVERNIGHT },
  ];

  // Computed properties
  fullAddress = computed(() => {
    const stopLocation = this.stop().location;
    if (!stopLocation) return 'Unknown location';

    if (stopLocation.address) {
      return stopLocation.address;
    }

    // Build address from components
    const addressParts = [stopLocation.city, stopLocation.state, stopLocation.country].filter(
      Boolean,
    );

    return addressParts.length > 0 ? addressParts.join(', ') : 'No address available';
  });

  // Timezone-aware computed properties
  locationTimezone = computed(() => {
    const location = this.stop().location;
    return location?.timezone || 'UTC';
  });

  locationTimezoneDisplayName = computed(() => {
    const location = this.stop().location;
    return location ? this.tripTimezoneService.getLocationTimezoneDisplayName(location) : 'UTC';
  });

  // Get current times in location timezone for display
  currentArrivalTimeInLocation = computed(() => {
    const currentStop = this.stop();
    if (!currentStop.plannedArrivalTime || !currentStop.location) return null;

    return this.tripTimezoneService.convertDateToLocationTimezone(
      currentStop.plannedArrivalTime,
      currentStop.location,
    );
  });

  currentDepartureTimeInLocation = computed(() => {
    const currentStop = this.stop();
    if (!currentStop.plannedArrivalTime || !currentStop.plannedDuration || !currentStop.location)
      return null;

    const arrivalTime = new Date(currentStop.plannedArrivalTime);
    const durationMs = currentStop.plannedDuration * 1000;
    const departureTime = new Date(arrivalTime.getTime() + durationMs);

    return this.tripTimezoneService.convertDateToLocationTimezone(
      departureTime,
      currentStop.location,
    );
  });

  plannedDuration = computed(() => {
    const form = this.stopForm?.value;
    if (!form?.plannedArrivalTime || !form?.plannedDepartureTime) {
      return null;
    }

    const arrivalTime = new Date(form.plannedArrivalTime);
    const departureTime = new Date(form.plannedDepartureTime);
    const durationMs = departureTime.getTime() - arrivalTime.getTime();

    // Convert milliseconds to minutes
    return Math.round(durationMs / 1000);
  });

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const currentStop = this.stop();

    // Convert UTC times to location timezone for display in form
    let localArrivalTime = null;
    let localDepartureTime = null;

    if (currentStop.plannedArrivalTime && currentStop.location) {
      localArrivalTime = this.tripTimezoneService
        .convertDateToLocationTimezone(currentStop.plannedArrivalTime, currentStop.location)
        .toJSDate();
    }

    if (currentStop.plannedArrivalTime && currentStop.plannedDuration && currentStop.location) {
      const arrivalTime = new Date(currentStop.plannedArrivalTime);
      const durationMs = currentStop.plannedDuration * 1000;
      const departureTime = new Date(arrivalTime.getTime() + durationMs);

      localDepartureTime = this.tripTimezoneService
        .convertDateToLocationTimezone(departureTime, currentStop.location)
        .toJSDate();
    }

    this.stopForm = this.formBuilder.group({
      plannedArrivalTime: [localArrivalTime],
      plannedDepartureTime: [localDepartureTime],
      stopType: [currentStop.stopType || null],
      notes: [currentStop.notes || '', [Validators.maxLength(1000)]],
    });
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.closeModal.emit();
  }

  onSave(): void {
    if (this.stopForm.invalid || this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    const formValue = this.stopForm.value;
    const currentStop = this.stop();

    // Convert form times from location timezone to UTC for backend storage
    let utcArrivalTime = null;
    let calculatedDuration = null;

    if (formValue.plannedArrivalTime && currentStop.location) {
      // Convert arrival time from location timezone to UTC
      const localArrivalTime = this.tripTimezoneService.convertDateToLocationTimezone(
        formValue.plannedArrivalTime,
        currentStop.location,
      );
      utcArrivalTime = this.tripTimezoneService.convertTimezoneAwareDateToUTC(localArrivalTime);

      // Calculate duration from arrival and departure times
      if (formValue.plannedDepartureTime) {
        const localDepartureTime = this.tripTimezoneService.convertDateToLocationTimezone(
          formValue.plannedDepartureTime,
          currentStop.location,
        );

        const durationMs = localDepartureTime.diff(localArrivalTime, 'milliseconds').milliseconds;
        calculatedDuration = Math.round(durationMs / 1000); // Keep in seconds

        // Basic validation: warn if times seem unreasonable
        const hour = localArrivalTime.hour;
        if (hour < 5 || hour > 23) {
          this.toastService.showWarn(
            'Unusual Time',
            `Arrival time ${localArrivalTime.toFormat('HH:mm')} might be outside typical hours for this location.`,
          );
        }
      }
    }

    // Prepare update request
    const updateRequest: Partial<Stop> = {
      plannedArrivalTime: utcArrivalTime,
      plannedDuration: calculatedDuration,
      stopType: formValue.stopType || null,
      notes: formValue.notes || null,
    };

    // Remove null/undefined values
    Object.keys(updateRequest).forEach(key => {
      if (
        updateRequest[key as keyof Partial<Stop>] === null ||
        updateRequest[key as keyof Partial<Stop>] === undefined
      ) {
        delete updateRequest[key as keyof Partial<Stop>];
      }
    });

    // Get current trip ID for the facade call
    const currentTrip = this.tripFacade.currentTrip();
    if (!currentTrip) {
      this.toastService.showError('Update Failed', 'No active trip found.');
      this.isLoading.set(false);
      return;
    }

    this.tripFacade.updateStop(currentTrip.id, this.stop().id, updateRequest)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Get the updated stop from the current trip state
          const updatedTrip = this.tripFacade.currentTrip();
          const updatedStop = updatedTrip?.stops.find(s => s.id === this.stop().id);

          if (updatedStop) {
            this.stopUpdated.emit(updatedStop);
          }

          this.toastService.showSuccess('Stop Updated', 'Stop details have been saved successfully.');
          this.onClose();
        },
        error: error => {
          console.error('Failed to update stop:', error);
          this.toastService.showError(
            'Update Failed',
            'Failed to update stop details. Please try again.',
          );
        },
        complete: () => {
          this.isLoading.set(false);
        },
      });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.stopForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string | null {
    const field = this.stopForm.get(fieldName);
    if (!field || !field.errors || !field.touched) {
      return null;
    }

    if (field.errors['required']) return `${fieldName} is required`;
    if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    if (field.errors['maxlength'])
      return `Maximum length is ${field.errors['maxlength'].requiredLength}`;

    return 'Invalid value';
  }

  hasChanges(): boolean {
    if (!this.stopForm) return false;

    const currentStop = this.stop();
    const formValue = this.stopForm.value;

    // Calculate current departure time from arrival + duration
    let currentDepartureTime = null;
    if (currentStop.plannedArrivalTime && currentStop.plannedDuration) {
      const arrivalTime = new Date(currentStop.plannedArrivalTime);
      const durationMs = currentStop.plannedDuration * 1000;
      currentDepartureTime = new Date(arrivalTime.getTime() + durationMs);
    }

    return (
      formValue.plannedArrivalTime !== currentStop.plannedArrivalTime ||
      formValue.plannedDepartureTime?.getTime() !== currentDepartureTime?.getTime() ||
      formValue.stopType !== currentStop.stopType ||
      formValue.notes !== currentStop.notes
    );
  }
}

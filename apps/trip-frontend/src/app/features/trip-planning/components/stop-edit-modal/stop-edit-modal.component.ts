import { Component, input, output, computed, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ToastService } from '../../../shared/services';
import { StopService } from '../../services/stop.service';
import { TripDataService } from '../../services/trip-data.service';
import { Stop, UpdateStopRequest } from '@trip-planner/types';
import { StopType } from '@prisma/client';

interface StopTypeOption {
  label: string;
  value: StopType;
}

@Component({
  selector: 'app-stop-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePickerModule,
    SelectModule,
    ButtonComponent
  ],
  templateUrl: './stop-edit-modal.component.html',
  styleUrls: ['./stop-edit-modal.component.css']
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
  private readonly stopService = inject(StopService);
  private readonly tripDataService = inject(TripDataService);
  private toastService = inject(ToastService);

  // Component state
  stopForm!: FormGroup;
  isLoading = signal<boolean>(false);
  
  // Stop type options
  stopTypeOptions: StopTypeOption[] = [
    { label: 'Pitstop', value: StopType.PITSTOP },
    { label: 'Overnight', value: StopType.OVERNIGHT }
  ];

  // Computed properties
  fullAddress = computed(() => {
    const stopLocation = this.stop().location;
    if (!stopLocation) return 'Unknown location';
    
    if (stopLocation.address) {
      return stopLocation.address;
    }
    
    // Build address from components
    const addressParts = [
      stopLocation.city,
      stopLocation.state,
      stopLocation.country
    ].filter(Boolean);
    
    return addressParts.length > 0 ? addressParts.join(', ') : 'No address available';
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
    return Math.round(durationMs / (1000 * 60));
  });

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const currentStop = this.stop();
    
    // Calculate planned departure time from arrival + duration if both exist
    let plannedDepartureTime = null;
    if (currentStop.plannedArrivalTime && currentStop.plannedDuration) {
      const arrivalTime = new Date(currentStop.plannedArrivalTime);
      const durationMs = currentStop.plannedDuration * 60 * 1000;
      plannedDepartureTime = new Date(arrivalTime.getTime() + durationMs);
    }
    
    this.stopForm = this.formBuilder.group({
      plannedArrivalTime: [currentStop.plannedArrivalTime || null],
      plannedDepartureTime: [plannedDepartureTime],
      stopType: [currentStop.stopType || null],
      notes: [currentStop.notes || '', [Validators.maxLength(1000)]]
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
    
    // Calculate duration from arrival and departure times
    let calculatedDuration = null;
    if (formValue.plannedArrivalTime && formValue.plannedDepartureTime) {
      const arrivalTime = new Date(formValue.plannedArrivalTime);
      const departureTime = new Date(formValue.plannedDepartureTime);
      const durationMs = departureTime.getTime() - arrivalTime.getTime();
      calculatedDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
    }
    
    // Prepare update request
    const updateRequest: UpdateStopRequest = {
      plannedArrivalTime: formValue.plannedArrivalTime || null,
      plannedDuration: calculatedDuration,
      stopType: formValue.stopType || null,
      notes: formValue.notes || null
    };

    // Remove null/undefined values
    Object.keys(updateRequest).forEach(key => {
      if (updateRequest[key as keyof UpdateStopRequest] === null || 
          updateRequest[key as keyof UpdateStopRequest] === undefined) {
        delete updateRequest[key as keyof UpdateStopRequest];
      }
    });

    this.stopService.updateStop(this.stop().id, updateRequest).subscribe({
      next: (updatedStop) => {
        // Update local state
        this.tripDataService.updateStop(updatedStop.id, updatedStop);
        
        // Emit success
        this.stopUpdated.emit(updatedStop);
        this.toastService.showSuccess('Stop Updated', 'Stop details have been saved successfully.');
        this.onClose();
      },
      error: (error) => {
        console.error('Failed to update stop:', error);
        this.toastService.showError('Update Failed', 'Failed to update stop details. Please try again.');
      },
      complete: () => {
        this.isLoading.set(false);
      }
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
    if (field.errors['maxlength']) return `Maximum length is ${field.errors['maxlength'].requiredLength}`;
    
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
      const durationMs = currentStop.plannedDuration * 60 * 1000;
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
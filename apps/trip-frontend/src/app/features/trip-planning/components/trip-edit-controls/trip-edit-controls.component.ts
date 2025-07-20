import { Component, input, output, computed, signal, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';

import { Trip } from '@trip-planner/types';
import { TripTimezoneService } from '../../services/trip-timezone.service';

export interface TripEditControlsData {
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

@Component({
  selector: 'app-trip-edit-controls',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePickerModule,
    ButtonModule,
  ],
  templateUrl: './trip-edit-controls.component.html',
  styleUrls: ['./trip-edit-controls.component.css']
})
export class TripEditControlsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private readonly tripTimezoneService = inject(TripTimezoneService);

  // Input properties
  readonly trip = input<Trip | null>(null);
  readonly disabled = input<boolean>(false);

  // Output events
  readonly tripDataChanged = output<TripEditControlsData>();

  // Form and expansion state
  tripForm!: FormGroup;
  isExpanded = signal<boolean>(false);

  // Timezone-aware computed properties
  readonly tripPrimaryTimezone = computed(() => {
    const currentTrip = this.trip();
    return this.tripTimezoneService.getTripPrimaryTimezone(currentTrip);
  });

  readonly tripPrimaryTimezoneDisplayName = computed(() => {
    const currentTrip = this.trip();
    return this.tripTimezoneService.getTripPrimaryTimezoneDisplayName(currentTrip);
  });

  ngOnInit(): void {
    this.initializeForm();
    this.setupFormSubscription();
  }

  private initializeForm(): void {
    const tripData = this.trip();
    
    // Convert UTC dates to primary timezone for display
    let localStartDate = null;
    let localEndDate = null;
    
    if (tripData?.startDate) {
      const formattedStartDate = this.tripTimezoneService.formatTripStartDate(tripData);
      localStartDate = formattedStartDate ? formattedStartDate.toJSDate() : tripData.startDate;
    }
    
    if (tripData?.endDate) {
      const formattedEndDate = this.tripTimezoneService.formatTripEndDate(tripData);
      localEndDate = formattedEndDate ? formattedEndDate.toJSDate() : tripData.endDate;
    }
    
    this.tripForm = this.fb.group({
      name: [
        tripData?.name || 'New Untitled Trip',
        [Validators.required, Validators.minLength(1), Validators.maxLength(100)]
      ],
      description: [tripData?.description || ''],
      startDate: [localStartDate],
      endDate: [localEndDate]
    });

    // Add custom validator for end date
    this.tripForm.addValidators(this.endDateValidator.bind(this));
  }

  private setupFormSubscription(): void {
    if (!this.tripForm) return;
    
    this.tripForm.valueChanges.subscribe(value => {
      if (this.tripForm && this.tripForm.valid) {
        // Convert dates from primary timezone back to UTC for storage
        const currentTrip = this.trip();
        const { startDate: utcStartDate, endDate: utcEndDate } = this.tripTimezoneService.convertTripDatesToUTC(
          value.startDate,
          value.endDate,
          undefined,
          currentTrip
        );
        
        this.tripDataChanged.emit({
          name: value.name || 'New Untitled Trip',
          description: value.description || null,
          startDate: utcStartDate,
          endDate: utcEndDate
        });
      }
    });
  }

  private endDateValidator(control: AbstractControl): {[key: string]: boolean} | null {
    const form = control as FormGroup;
    const startDate = form.get('startDate')?.value;
    const endDate = form.get('endDate')?.value;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return { endDateBeforeStart: true };
    }

    return null;
  }

  toggleExpanded(): void {
    this.isExpanded.update(current => !current);
  }

  // Computed properties for form validation
  readonly isFormValid = computed(() => this.tripForm?.valid ?? false);
  
  readonly nameErrors = computed(() => {
    if (!this.tripForm) return null;
    
    const nameControl = this.tripForm.get('name');
    if (!nameControl || !nameControl.errors || !nameControl.touched) {
      return null;
    }
    
    if (nameControl.errors['required']) {
      return 'Trip name is required';
    }
    if (nameControl.errors['minlength']) {
      return 'Trip name must be at least 1 character';
    }
    if (nameControl.errors['maxlength']) {
      return 'Trip name cannot exceed 100 characters';
    }
    return null;
  });

  readonly dateErrors = computed(() => {
    if (!this.tripForm) return null;
    
    if (!this.tripForm.errors || !this.tripForm.touched) {
      return null;
    }
    
    if (this.tripForm.errors['endDateBeforeStart']) {
      return 'End date must be after start date';
    }
    return null;
  });

  readonly descriptionLength = computed(() => {
    if (!this.tripForm) return 0;
    
    const description = this.tripForm.get('description')?.value || '';
    return description.length;
  });

  readonly descriptionMaxLength = 500;
}
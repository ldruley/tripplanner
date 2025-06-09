import { Component, Input, Output, EventEmitter, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { Profile, UpdateProfile } from '@trip-planner/types';

@Component({
  selector: 'app-profile-edit',
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.css',
})
export class ProfileEditComponent implements OnInit {
  @Input({ required: true }) profile!: Profile;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() saveRequested = new EventEmitter<UpdateProfile>();
  @Output() cancelRequested = new EventEmitter<void>();

  public profileForm!: FormGroup;
  public avatarPreview = signal<string | null>(null);
  private initialFormValue = signal<any>(null);

  constructor(private formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
    this.updateAvatarPreview();
  }

  private initializeForm(): void {
    this.profileForm = this.formBuilder.group({
      firstName: [
        this.profile.firstName || '',
        [Validators.minLength(2), Validators.maxLength(100)]
      ],
      lastName: [
        this.profile.lastName || '',
        [Validators.minLength(2), Validators.maxLength(100)]
      ],
      displayName: [
        this.profile.displayName || '',
        [Validators.maxLength(200)]
      ],
      avatarUrl: [
        this.profile.avatarUrl || '',
        [Validators.pattern(/^https?:\/\/.+/)]
      ]
    });

    // Store initial form value for change detection
    this.initialFormValue.set(this.profileForm.value);

    // Update avatar preview when URL changes
    this.profileForm.get('avatarUrl')?.valueChanges.subscribe(() => {
      this.updateAvatarPreview();
    });
  }

  public isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  public hasChanges(): boolean {
    const current = this.profileForm.value;
    const initial = this.initialFormValue();

    return JSON.stringify(current) !== JSON.stringify(initial);
  }

  public updateAvatarPreview(): void {
    const avatarUrl = this.profileForm.get('avatarUrl')?.value;
    this.avatarPreview.set(avatarUrl || null);
  }

  public removeAvatar(): void {
    this.profileForm.patchValue({ avatarUrl: '' });
    this.avatarPreview.set(null);
  }

  public resetForm(): void {
    this.profileForm.patchValue(this.initialFormValue());
    this.updateAvatarPreview();
  }

  public onSubmit(): void {
    if (this.profileForm.invalid || !this.hasChanges()) {
      this.markAllFieldsAsTouched();
      return;
    }

    const formValue = this.profileForm.value;

    // Create update payload, only including non-empty values
    const updateData: UpdateProfile = {};

    if (formValue.firstName?.trim()) {
      updateData.firstName = formValue.firstName.trim();
    } else {
      updateData.firstName = null;
    }

    if (formValue.lastName?.trim()) {
      updateData.lastName = formValue.lastName.trim();
    } else {
      updateData.lastName = null;
    }

    if (formValue.displayName?.trim()) {
      updateData.displayName = formValue.displayName.trim();
    } else {
      updateData.displayName = null;
    }

    if (formValue.avatarUrl?.trim()) {
      updateData.avatarUrl = formValue.avatarUrl.trim();
    } else {
      updateData.avatarUrl = null;
    }

    this.saveRequested.emit(updateData);
  }

  public onCancel(): void {
    this.cancelRequested.emit();
  }

  public onAvatarError(event: Event): void {
    // Show placeholder when avatar fails to load
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    this.avatarPreview.set(null);
  }

  public getStatusDisplay(): string {
    switch (this.profile.status) {
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      this.profileForm.get(key)?.markAsTouched();
    });
  }
}

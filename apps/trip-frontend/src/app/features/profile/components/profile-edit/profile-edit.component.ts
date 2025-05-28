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
      first_name: [
        this.profile.first_name || '',
        [Validators.minLength(2), Validators.maxLength(100)]
      ],
      last_name: [
        this.profile.last_name || '',
        [Validators.minLength(2), Validators.maxLength(100)]
      ],
      display_name: [
        this.profile.display_name || '',
        [Validators.maxLength(200)]
      ],
      avatar_url: [
        this.profile.avatar_url || '',
        [Validators.pattern(/^https?:\/\/.+/)]
      ]
    });

    // Store initial form value for change detection
    this.initialFormValue.set(this.profileForm.value);

    // Update avatar preview when URL changes
    this.profileForm.get('avatar_url')?.valueChanges.subscribe(() => {
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
    const avatarUrl = this.profileForm.get('avatar_url')?.value;
    this.avatarPreview.set(avatarUrl || null);
  }

  public removeAvatar(): void {
    this.profileForm.patchValue({ avatar_url: '' });
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

    if (formValue.first_name?.trim()) {
      updateData.first_name = formValue.first_name.trim();
    } else {
      updateData.first_name = null;
    }

    if (formValue.last_name?.trim()) {
      updateData.last_name = formValue.last_name.trim();
    } else {
      updateData.last_name = null;
    }

    if (formValue.display_name?.trim()) {
      updateData.display_name = formValue.display_name.trim();
    } else {
      updateData.display_name = null;
    }

    if (formValue.avatar_url?.trim()) {
      updateData.avatar_url = formValue.avatar_url.trim();
    } else {
      updateData.avatar_url = null;
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

  public getRoleDisplay(): string {
    switch (this.profile.role) {
      case 'admin':
        return 'Administrator';
      case 'moderator':
        return 'Moderator';
      case 'user':
        return 'User';
      default:
        return 'Unknown';
    }
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

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { buildChangePasswordForm } from '../../../../core/forms/form-factory';
import { ChangePasswordCredentials } from '../../services/auth.service';

@Component({
  selector: 'app-change-password-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password-form.component.html',
  styleUrl: './change-password-form.component.css',
})
export class ChangePasswordFormComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() changePasswordSubmit = new EventEmitter<ChangePasswordCredentials>();
  @Output() cancelPasswordChange = new EventEmitter<void>();
  readonly changePasswordForm = buildChangePasswordForm(new FormBuilder());

  public readonly showOldPassword = signal(false);
  public readonly showNewPassword = signal(false);
  public readonly showConfirmPassword = signal(false);

  toggleOldPasswordVisibility(): void {
    this.showOldPassword.update(v => !v);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.changePasswordForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private markAllFieldsAsTouched(): void {
    Object.values(this.changePasswordForm.controls).forEach(control => control.markAsTouched());
  }

  public hasPasswordMismatch(): boolean {
    return !!(
      this.changePasswordForm.errors?.['passwordMismatch'] &&
      this.changePasswordForm.get('confirmPassword')?.touched
    );
  }

  handleCancelClick(): void {
    this.cancelPasswordChange.emit();
  }

  public onSubmit(): void {
    this.markAllFieldsAsTouched();
    if (this.changePasswordForm.invalid) {
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;

    const credentials: ChangePasswordCredentials = {
      currentPassword,
      newPassword,
      confirmPassword,
    };

    this.changePasswordSubmit.emit(credentials);
  }
}

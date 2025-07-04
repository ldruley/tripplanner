import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';
import { buildForgotPasswordForm } from '../../../../core/forms/form-factory';

export interface RecoverPasswordCredentials {
  email: string;
}

@Component({
  selector: 'app-recover-password-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './recover-password-form.component.html',
  styleUrls: ['./recover-password-form.component.css'],
})
export class RecoverPasswordFormComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() recoverPasswordSubmit = new EventEmitter<RecoverPasswordCredentials>();

  readonly recoverPasswordForm = buildForgotPasswordForm(new FormBuilder());

  isFieldInvalid(field: string): boolean {
    const control = this.recoverPasswordForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private markAllFieldsAsTouched(): void {
    Object.values(this.recoverPasswordForm.controls).forEach(control => control.markAsTouched());
  }

  onSubmit(): void {
    this.markAllFieldsAsTouched();
    if (this.recoverPasswordForm.valid) {
      this.recoverPasswordSubmit.emit(this.recoverPasswordForm.value as RecoverPasswordCredentials);
    }
  }
}

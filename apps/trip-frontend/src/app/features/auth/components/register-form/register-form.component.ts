import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CreateUser } from '@trip-planner/types';
import { buildRegisterForm } from '../../../../core/forms/form-factory';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register-form.component.html',
  styleUrl: './register-form.component.css'
})
export class RegisterFormComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() registerSubmit = new EventEmitter<CreateUser>();
  readonly registerForm = buildRegisterForm(new FormBuilder());

  public readonly showPassword = signal(false);
  public readonly showConfirmPassword = signal(false);


  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(v => !v);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private markAllFieldsAsTouched(): void {
    Object.values(this.registerForm.controls).forEach(control => control.markAsTouched());
  }

  public hasPasswordMismatch(): boolean {
    return !!(this.registerForm.errors?.['passwordMismatch'] &&
      this.registerForm.get('confirmPassword')?.touched);
  }

  public onSubmit(): void {
    this.markAllFieldsAsTouched();
    if (this.registerForm.invalid) {
      return;
    }

    const { firstName, lastName, email, password } = this.registerForm.value;

    const credentials: CreateUser = {
      firstName,
      lastName,
      email,
      password
    };

    this.registerSubmit.emit(credentials);
  }
}

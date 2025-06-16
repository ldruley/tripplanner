import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoginUser} from '@trip-planner/types';
import { buildLoginForm } from '../../../../core/forms/form-factory';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, // For formGroup, formControlName, ngSubmit
    RouterLink // For routerLink directive
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.css' // Using styleUrl for a single CSS file
})
export class LoginFormComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() loginSubmit = new EventEmitter<LoginUser>();

  readonly loginForm = buildLoginForm(new FormBuilder());
  public readonly showPasswordSignal = signal(false);

  togglePasswordVisibility(): void {
    this.showPasswordSignal.update(v => !v);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private markAllFieldsAsTouched(): void {
    Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
  }

  onSubmit(): void {
    this.markAllFieldsAsTouched();
    if (this.loginForm.valid) {
      this.loginSubmit.emit(this.loginForm.value as LoginUser);
    }
  }
}

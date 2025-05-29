import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { buildLoginForm } from '../../../../core/forms/form-factory';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.css'],
})
export class LoginFormComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Output() loginSubmit = new EventEmitter<{ email: string; password: string }>();

  readonly loginForm = buildLoginForm(new FormBuilder());
  private show = false;

  showPassword() {
    return this.show;
  }

  togglePasswordVisibility() {
    this.show = !this.show;
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
      this.loginSubmit.emit(this.loginForm.value);
    }
  }
}

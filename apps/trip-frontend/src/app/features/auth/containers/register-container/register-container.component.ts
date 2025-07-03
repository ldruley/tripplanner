import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
import { AuthService, SignUpCredentials, AuthState } from '../../services/auth.service';

@Component({
  selector: 'app-register-container',
  standalone: true,
  imports: [CommonModule, RouterLink, RegisterFormComponent],
  templateUrl: './register-container.component.html',
  styleUrl: './register-container.component.css',
})
export class RegisterContainerComponent {
  private readonly authService = inject(AuthService);

  public readonly authState$ = this.authService.authState$;
  public readonly isLoading$ = this.authState$.pipe(map(state => state.loading));
  public readonly error$ = this.authState$.pipe(map(state => state.error));

  registrationSuccess = false;
  registeredEmail = '';

  public async handleRegister(credentials: SignUpCredentials): Promise<void> {
    const result = await this.authService.signUp(credentials);

    if (result.success) {
      this.registrationSuccess = true;
      this.registeredEmail = credentials.email;
    }
  }

  resendVerification(): void {
    if (this.registeredEmail) {
      this.authService.resendVerificationEmail(this.registeredEmail).subscribe({
        next: result => {
          if (result.success) {
            console.log('Verification email resent successfully');
          } else {
            console.error('Failed to resend verification email:', result.error);
          }
        },
        error: error => {
          console.error('Error resending verification email:', error);
        },
      });
    }
  }
}

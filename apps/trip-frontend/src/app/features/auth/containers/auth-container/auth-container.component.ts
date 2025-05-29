import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';

import { AuthService, ChangePasswordCredentials, LoginCredentials, SignUpCredentials } from '../../services/auth.service';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
//import { ForgotPasswordFormComponent } from '../forgot-password-form/forgot-password-form.component';
//import { ResetPasswordFormComponent } from '../reset-password-form/reset-password-form.component';
import { map } from 'rxjs/operators';
import { ChangePasswordFormComponent } from '../../components/change-password-form/change-password-form.component';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-auth-container',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    LoginFormComponent,
    RegisterFormComponent,
    ChangePasswordFormComponent,
    //ForgotPasswordFormComponent,
    //ResetPasswordFormComponent,
  ],
  templateUrl: './auth-container.component.html',
  styleUrls: ['./auth-container.component.css'],
})
export class AuthContainerComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private route = inject(ActivatedRoute);

  currentForm: 'login' | 'register' | 'forgot' | 'change-password' = 'login';
  resetToken: string | null = null;

  public readonly toastMessage = signal<ToastMessage | null>(null);

  public readonly authState$ = this.authService.authState$;
  public readonly isLoading$ = this.authState$.pipe(
    map((state) => state.loading)
  );
  public readonly error$ = this.authState$.pipe(map((state) => state.error));

  constructor() {
    this.route.url.subscribe((segments) => {
      const path = segments.map((s) => s.path).join('/');
      if (path.includes('register')) this.currentForm = 'register';
      else if (path.includes('forgot')) this.currentForm = 'forgot';
      else if (path.includes('change-password')) {
        this.currentForm = 'change-password';
      } else {
        this.currentForm = 'login';
      }
    });
  }

  public async handleRegister(credentials: SignUpCredentials): Promise<void> {
      const result = await this.authService.signUp(credentials);

      if (result.success) {
        this.showToast('success', 'Registration successful! Please check your email for verification.');
      } else if (result.error) {
        this.showToast('error', result.error);
      }
    }

    public async handleLogin(credentials: LoginCredentials): Promise<void> {
      const result = await this.authService.signIn(credentials);

      if (result && !result.success && result.error) {
        this.showToast('error', result.error);
      }
    }

    public async handleChangePassword(credentials: ChangePasswordCredentials): Promise<void> {
      const result = await this.authService.updatePassword(credentials);

      if (result.success) {
        this.showToast('success', 'Password updated successfully!');
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 2000);
      } else if (result.error) {
        this.showToast('error', result.error);
      }
    }


  private showToast(type: 'success' | 'error', message: string): void {
      this.toastMessage.set({ type, message });

      // Auto-hide toast after 5 seconds
      setTimeout(() => {
        this.toastMessage.set(null);
      }, 5000);
    }

    public dismissToast(): void {
      this.toastMessage.set(null);
    }
}

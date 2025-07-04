import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { LoginUser, CreateUser, ChangePassword } from '@trip-planner/types';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
import { RecoverPasswordFormComponent } from '../../components/recover-password/recover-password-form.component';
import { ChangePasswordFormComponent } from '../../components/change-password-form/change-password-form.component';
import { ToastService } from '../../../shared/services';

type AuthFormType = 'login' | 'register' | 'recover' | 'change-password';

@Component({
  selector: 'app-auth-container',
  standalone: true,
  imports: [
    LoginFormComponent,
    RegisterFormComponent,
    ChangePasswordFormComponent,
    RecoverPasswordFormComponent
],
  templateUrl: './auth-container.component.html',
  styleUrls: ['./auth-container.component.css'],
})
export class AuthContainerComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);

  // --- State Signals ---
  private readonly authState = toSignal(this.authService.authState$);

  // --- Computed Signals for the View ---
  public readonly isLoading = computed(() => this.authState()?.loading ?? false);
  public readonly error = computed(() => this.authState()?.error ?? null);

  public readonly currentForm = toSignal(
    this.route.url.pipe(
      map(segments => {
        const path = segments[0]?.path;
        switch (path) {
          case 'register':
            return 'register' as AuthFormType;
          case 'forgot':
            return 'recover' as AuthFormType;
          case 'change-password':
            return 'change-password' as AuthFormType;
          default:
            return 'login' as AuthFormType;
        }
      }),
    ),
    { initialValue: 'login' as AuthFormType },
  );

  public async handleRegister(credentials: CreateUser): Promise<void> {
    const result = await firstValueFrom(this.authService.signUp(credentials));

    if (result.success) {
      this.toastService.showSuccess('Registration successful!', 'Please sign in to continue.');
      this.router.navigate(['/auth/login']);
    } else if (result.error) {
      this.toastService.showError('Registration failed', result.error);
    }
  }

  public async handleLogin(credentials: LoginUser): Promise<void> {
    const result = await firstValueFrom(this.authService.signIn(credentials));
    if (!result.success && result.error) {
      this.toastService.showError('Login failed', result.error);
    }
  }

  public async handleRecoverPassword(email: string): Promise<void> {
    const result = await this.authService.resetPassword(email);
    if (result.success) {
      this.toastService.showSuccess(
        'Recovery email sent!',
        'Please check your inbox for password reset instructions.',
      );
    } else if (result.error) {
      this.toastService.showError('Password recovery failed', result.error);
    }
  }

  public async handleChangePassword(credentials: ChangePassword): Promise<void> {
    const result = await this.authService.updatePassword(credentials);
    if (result.success) {
      this.toastService.showSuccess(
        'Password updated!',
        'Your password has been successfully updated.',
      );
      setTimeout(() => this.router.navigate(['/profile']), 2000);
    } else if (result.error) {
      this.toastService.showError('Password update failed', result.error);
    }
  }

  public handleCancel(): void {
    this.router.navigate(['/profile']).catch(err => {
      console.error('Navigation to profile failed:', err);
    });
  }
}

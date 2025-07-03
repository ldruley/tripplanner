import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { LoginUser, CreateUser, ChangePassword } from '@trip-planner/types';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
import { RecoverPasswordFormComponent } from '../../components/recover-password/recover-password-form.component';
import { ChangePasswordFormComponent } from '../../components/change-password-form/change-password-form.component';

interface ToastMessage {
  type: 'success' | 'error';
  message: string;
}

type AuthFormType = 'login' | 'register' | 'recover' | 'change-password';

@Component({
  selector: 'app-auth-container',
  standalone: true,
  imports: [
    CommonModule,
    LoginFormComponent,
    RegisterFormComponent,
    ChangePasswordFormComponent,
    RecoverPasswordFormComponent,
  ],
  templateUrl: './auth-container.component.html',
  styleUrls: ['./auth-container.component.css'],
})
export class AuthContainerComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // --- State Signals ---
  private readonly authState = toSignal(this.authService.authState$);
  public readonly toastMessage = signal<ToastMessage | null>(null);

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
      this.showToast('success', 'Registration successful! Please sign in to continue.');
      this.router.navigate(['/auth/login']);
    } else if (result.error) {
      this.showToast('error', result.error);
    }
  }

  public async handleLogin(credentials: LoginUser): Promise<void> {
    const result = await firstValueFrom(this.authService.signIn(credentials));
    if (!result.success && result.error) {
      this.showToast('error', result.error);
    }
  }

  public async handleRecoverPassword(email: string): Promise<void> {
    const result = await this.authService.resetPassword(email);
    if (result.success) {
      this.showToast('success', 'Password recovery email sent! Please check your inbox.');
    } else if (result.error) {
      this.showToast('error', result.error);
    }
  }

  public async handleChangePassword(credentials: ChangePassword): Promise<void> {
    const result = await this.authService.updatePassword(credentials);
    if (result.success) {
      this.showToast('success', 'Password updated successfully!');
      setTimeout(() => this.router.navigate(['/profile']), 2000);
    } else if (result.error) {
      this.showToast('error', result.error);
    }
  }

  public handleCancel(): void {
    this.router.navigate(['/profile']).catch(err => {
      console.error('Navigation to profile failed:', err);
    });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toastMessage.set({ type, message });
    setTimeout(() => this.toastMessage.set(null), 5000);
  }

  public dismissToast(): void {
    this.toastMessage.set(null);
  }

  public getToastClasses(type: 'success' | 'error'): string {
    const baseClasses = 'flex items-center justify-between p-4 rounded-lg shadow-lg border';
    if (type === 'success') {
      return `${baseClasses} bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400`;
    } else {
      return `${baseClasses} bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400`;
    }
  }
}

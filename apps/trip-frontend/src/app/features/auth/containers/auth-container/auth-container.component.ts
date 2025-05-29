import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';

import { AuthService, ChangePasswordCredentials, LoginCredentials, SignUpCredentials } from '../../services/auth.service';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
//import { ForgotPasswordFormComponent } from '../forgot-password-form/forgot-password-form.component';
//import { ResetPasswordFormComponent } from '../reset-password-form/reset-password-form.component';
import { map } from 'rxjs/operators';
import { ChangePasswordFormComponent } from '../../components/change-password-form/change-password-form.component';

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
  private route = inject(ActivatedRoute);

  currentForm: 'login' | 'register' | 'forgot' | 'reset' = 'login';
  resetToken: string | null = null;

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
      else if (path.includes('reset')) {
        this.currentForm = 'reset';
        this.resetToken = this.route.snapshot.queryParamMap.get('token');
      } else {
        this.currentForm = 'login';
      }
    });
  }

  public async handleRegister(credentials: SignUpCredentials): Promise<void> {
    const result = await this.authService.signUp(credentials);

    if (result.success) {
      // TODO: Succes message or redirect
      // For now, the auth service will handle navigation via the auth state change
      console.log(
        'Registration successful! Please check your email for verification.'
      );
    }
  }

  public async handleLogin(credentials: LoginCredentials): Promise<void> {
    await this.authService.signIn(credentials);
  }

  public async handleChangePassword(
    credentials: ChangePasswordCredentials
  ): Promise<void> {
    await this.authService.updatePassword(credentials);
  }
}

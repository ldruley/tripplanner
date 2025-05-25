import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RegisterFormComponent } from '../../components/register-form/register-form.component';
import { AuthService, SignUpCredentials, AuthState } from '../../services/auth.service';

@Component({
  selector: 'app-register-container',
  standalone: true,
  imports: [CommonModule, RegisterFormComponent],
  templateUrl: './register-container.component.html',
  styleUrl: './register-container.component.css',
})
export class RegisterContainerComponent {
  private readonly authService = inject(AuthService);

  public readonly authState$ = this.authService.authState$;
  public readonly isLoading$ = this.authState$.pipe(map(state => state.loading));
  public readonly error$ = this.authState$.pipe(map(state => state.error));

  public async handleRegister(credentials: SignUpCredentials): Promise<void> {
    const result = await this.authService.signUp(credentials);

    if (result.success) {
      // TODO: Succes message or redirect
      // For now, the auth service will handle navigation via the auth state change
      console.log('Registration successful! Please check your email for verification.');
    }
  }
}

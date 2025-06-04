import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs/operators';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { AuthService, LoginCredentials } from '../../services/auth.service';

@Component({
  selector: 'app-login-container',
  standalone: true,
  imports: [CommonModule, LoginFormComponent],
  templateUrl: './login-container.component.html',
  styleUrl: './login-container.component.css',
})
export class LoginContainerComponent {
  private readonly authService = inject(AuthService);

  public readonly authState$ = this.authService.authState$;
  public readonly isLoading$ = this.authState$.pipe(map(state => state.loading));
  public readonly error$ = this.authState$.pipe(map(state => state.error));

  public async handleLogin(credentials: LoginCredentials): Promise<void> {
    await this.authService.signIn(credentials);
  }
}

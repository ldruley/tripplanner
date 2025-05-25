import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { AuthService } from '../../../auth/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ButtonComponent],
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  public readonly isAuthenticated$: Observable<boolean>;

  constructor() {
    this.isAuthenticated$ = this.authService.authState$.pipe(
      map(state => state.user !== null)
    );
  }

  onLogin() {
    this.router.navigate(['/auth/login']);
  }

  onRegister() {
    this.router.navigate(['/auth/register']);
  }

  async onSignOut() {
    await this.authService.signOut();
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  //public readonly userDisplayName$: Observable<string | null>;

  constructor() {
    /* this.userDisplayName$ = this.authService.authState$.pipe(
      map(state => {
        if (state.user?.userMetadata?.['display_name']) {
          return state.user.user_metadata['display_name'];
        }
        if (state.user?.user_metadata?.['first_name']) {
          const firstName = state.user.user_metadata['first_name'];
          const lastName = state.user?.user_metadata?.['last_name'] || '';
          return `${firstName} ${lastName}`.trim();
        }
        return state.user?.email || null;
      })
    );*/
  }

  ngOnInit(): void {
    // Check if user is authenticated, redirect to login if not
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
    }
  }

  public async handleSignOut(): Promise<void> {
    await this.authService.signOut();
  }

  public handleNewTrip(): void {
    this.router.navigate(['/trip-planning/new']);
  }
}

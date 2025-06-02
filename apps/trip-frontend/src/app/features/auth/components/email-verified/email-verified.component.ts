import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-email-verified',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './email-verified.component.html',
  styleUrls: ['./email-verified.component.css']
})
export class EmailVerifiedComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private authSubscription: Subscription | undefined;

  isLoading = true;
  verificationStatus: 'success' | 'error' | 'verifying' = 'verifying';
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.authSubscription = this.authService.authState$.pipe(
      map(state => {
        if (state.loading) {
          return 'verifying';
        }
        if (state.user && state.user.email_confirmed_at) {
          return 'success';
        }
        if (state.user && !state.user.email_confirmed_at) {
          // This case might happen if the user is logged in but email is not yet confirmed
          // Or if Supabase redirected but the event hasn't fully processed.
          // We might need a slight delay or rely on the user already being confirmed by the time they hit this page.
          // For now, if user exists but not confirmed, we'll treat as still verifying or potentially an issue.
          // Supabase should handle the confirmation before redirecting to this callback.
          // If the user lands here, and `email_confirmed_at` is set, it's a success.
          // If not, it could be an error or a delay.
          return 'verifying'; // Or 'error' if we are sure it should be confirmed by now.
        }
        if (state.error) {
          this.errorMessage = state.error;
          return 'error';
        }
        // If no user and no error, and not loading, it's ambiguous.
        return 'verifying'; // Default to verifying if state is unclear.
      })
    ).subscribe(status => {
      // Add a small delay to allow auth state to settle, especially after redirection
      setTimeout(() => {
        this.verificationStatus = status;
        this.isLoading = status === 'verifying';

        if (status === 'success') {
          // Optional: redirect after a few seconds
          // setTimeout(() => this.router.navigate(['/dashboard']), 3000);
        } else if (status === 'error' && !this.errorMessage) {
          this.errorMessage = 'Email verification failed. The link may be invalid or expired.';
        }
      }, 1000); // 1 second delay
    });

    // Check initial state immediately too, in case it's already resolved
    const initialAuthState = this.authService.getCurrentUser();
    if (initialAuthState && initialAuthState.email_confirmed_at) {
        this.verificationStatus = 'success';
        this.isLoading = false;
    } else if (!initialAuthState && !this.authService.authStateSubject.value.loading) {
        // If there's no user and not loading, it might be an issue if we expect one.
        // However, onAuthStateChange should handle this.
        // This is more of a fallback.
    }
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}


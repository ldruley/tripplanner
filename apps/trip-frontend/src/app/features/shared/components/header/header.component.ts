import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { AuthService } from '../../../auth/services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AvatarComponent } from '../avatar/avatar.component';
import { ProfileService } from '../../../profile/services/profile.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ButtonComponent, AvatarComponent],
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  //TODO: pulling full profile for photo, find a better way probably (unless we end up needing more profile data in header)

  public readonly isAuthenticated$: Observable<boolean>;
  public readonly currentUser$: Observable<any>;
  public readonly currentProfile = this.profileService.profile$;

  private readonly authState = toSignal(this.authService.authState$, { initialValue: null });

  constructor() {
    this.isAuthenticated$ = this.authService.authState$.pipe(
      map(state => state.user !== null)
    );

    this.currentUser$ = this.authService.authState$.pipe(
      map(state => state.user)
    );

    effect(() => {
      const auth = this.authState();
      if (auth?.user && !this.currentProfile()) {
        // Only fetch if we don't already have profile data
        this.profileService.refreshProfile();
      }
    });
  }



  getUserAvatarUrl(user: any): string | null {
    const profile = this.currentProfile();
    return profile?.avatar_url || null;
  }

  getUserDisplayName(user: any): string {
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name;
    }

    if (user?.user_metadata?.first_name || user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name || ''} ${user.user_metadata.last_name || ''}`.trim();
    }

    return user?.email?.split('@')[0] || 'User';
  }

  onHome() {
    // Navigate to home/dashboard based on auth state
    const isAuthenticated = this.authService.isAuthenticated();
    if (isAuthenticated) {
      this.router.navigate(['/dashboard']);
    } else {
      // Could navigate to a landing page or stay on current page
      // For now, let's navigate to login if not authenticated
      this.router.navigate(['/auth/login']);
    }
  }

  onLogin() {
    this.router.navigate(['/auth/login']);
  }

  onRegister() {
    this.router.navigate(['/auth/register']);
  }

  onProfile() {
    this.router.navigate(['/profile']);
  }

  async onSignOut() {
    try {
      await this.authService.signOut();
      // Navigation will be handled by the auth state change in AuthService
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}

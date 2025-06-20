import { Component, computed, effect, inject } from '@angular/core';
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

  private readonly authState = toSignal(this.authService.authState$);
  public readonly userProfile = this.profileService.userProfile$;

  public readonly isAuthenticated = computed(() => !!this.authState()?.user);
  public readonly user = computed(() => this.authState()?.user);

  public readonly userAvatarUrl = computed(() => {
    return this.userProfile()?.avatarUrl || null;
  });

  public readonly userDisplayName = computed(() => {
    const profile = this.userProfile();
    const user = this.user();

    if (profile?.displayName) {
      return profile.displayName;
    }
    if (profile?.firstName || profile?.lastName) {
      return `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
    }
    // Fallback to the email from the auth state if no profile name is set
    return user?.email?.split('@')[0] || 'User';
  });

  onHome(): void {
    // Navigate to dashboard if authenticated, otherwise to login
    if (this.isAuthenticated()) {
      this.router.navigate(['/dashboard']).catch(err => {
        console.error('Navigation to dashboard failed:', err);
      });
    } else {
      this.router.navigate(['/auth/login']).catch(err => {
        console.error('Navigation to login failed:', err);
      });
    }
  }

  onLogin(): void {
    this.router.navigate(['/auth/login']).catch(err => {
      console.error('Navigation failed:', err);
    });
  }

  onRegister(): void {
    this.router.navigate(['/auth/register']).catch(err => {
      console.error('Navigation failed:', err);
    });
  }

  onProfile(): void {
    this.router.navigate(['/profile']).catch(err => {
      console.error('Navigation failed:', err);
    });
  }

  onSignOut(): void {
    this.authService.signOut();
    // Navigation is handled automatically by the AuthService upon state change
  }
}

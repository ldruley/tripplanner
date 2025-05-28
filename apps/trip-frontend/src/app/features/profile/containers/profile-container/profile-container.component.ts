import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ProfileService } from '../../services/profile.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ProfileDisplayComponent } from '../../components/profile-display/profile-display.component';
import { ProfileEditComponent } from '../../components/profile-edit/profile-edit.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

import { Profile, UpdateProfile } from '@trip-planner/types';

@Component({
  selector: 'app-profile-container',
  standalone: true,
  imports: [
    CommonModule,
    ProfileDisplayComponent,
    ProfileEditComponent,
    ButtonComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './profile-container.component.html',
  styleUrl: './profile-container.component.css',
})
export class ProfileContainerComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  public readonly profileState = this.profileService.profileState$;
  public readonly toastMessage = signal<string | null>(null);

  ngOnInit(): void {
    if(!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return;
    }

    if(!this.profileState().profile) {
      this.profileService.refreshProfile();
    }
  }

  handleEditRequested(): void {
    this.profileService.setEditMode(true);
  }

  handleCancelRequested(): void {
    this.profileService.setEditMode(false);
  }

  handleSaveRequested(updateData: UpdateProfile): void {
    this.profileService.updateProfile(updateData);
    this.showToast('Profile updated successfully!');
  }

  handleRefresh(): void {
    this.profileService.refreshProfile();
  }

  handleBackToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);

    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}

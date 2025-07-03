import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ProfileService } from '../../services/profile.service';
import { ProfileDisplayComponent } from '../../components/profile-display/profile-display.component';
import { ProfileEditComponent } from '../../components/profile-edit/profile-edit.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

import { UpdateProfile } from '@trip-planner/types';

@Component({
  selector: 'app-profile-container',
  standalone: true,
  imports: [
    CommonModule,
    ProfileDisplayComponent,
    ProfileEditComponent,
    ButtonComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './profile-container.component.html',
  styleUrl: './profile-container.component.css',
})
export class ProfileContainerComponent {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  public readonly state = this.profileService.state$;

  public readonly toastMessage = signal<string | null>(null);

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

  handleChangePasswordRequested(): void {
    this.router.navigate(['/auth/change-password']).catch(err => {
      console.error('Navigation failed:', err);
    });
  }

  handleBackToDashboard(): void {
    this.router.navigate(['/dashboard']).catch(err => {
      console.error('Navigation failed:', err);
    });
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);

    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}

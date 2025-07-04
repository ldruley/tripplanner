import { Component, inject } from '@angular/core';

import { Router } from '@angular/router';

import { ProfileService } from '../../services/profile.service';
import { ProfileDisplayComponent } from '../../components/profile-display/profile-display.component';
import { ProfileEditComponent } from '../../components/profile-edit/profile-edit.component';
import { ButtonComponent } from '../../../shared/components';
import { LoadingSpinnerComponent } from '../../../shared/components';
import { ToastService } from '../../../shared/services';

import { UpdateProfile } from '@trip-planner/types';

@Component({
  selector: 'app-profile-container',
  standalone: true,
  imports: [
    ProfileDisplayComponent,
    ProfileEditComponent,
    ButtonComponent,
    LoadingSpinnerComponent
],
  templateUrl: './profile-container.component.html',
  styleUrl: './profile-container.component.css',
})
export class ProfileContainerComponent {
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  public readonly state = this.profileService.state$;

  handleEditRequested(): void {
    this.profileService.setEditMode(true);
  }

  handleCancelRequested(): void {
    this.profileService.setEditMode(false);
  }

  handleSaveRequested(updateData: UpdateProfile): void {
    this.profileService.updateProfile(updateData);
    this.toastService.showSuccess(
      'Profile updated!',
      'Your profile has been successfully updated.',
    );
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
}

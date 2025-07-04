import { Component, Input, Output, EventEmitter } from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { UserProfile } from '../../types/profile.types';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-profile-display',
  standalone: true,
  imports: [ButtonComponent, AvatarComponent],
  templateUrl: './profile-display.component.html',
  styleUrl: './profile-display.component.css',
})
export class ProfileDisplayComponent {
  @Input({ required: true }) userProfile!: UserProfile;
  @Input() loading = false;

  @Output() editRequested = new EventEmitter<void>();
  @Output() changePasswordRequested = new EventEmitter<void>();

  getDisplayName(): string {
    if (this.userProfile.displayName) {
      return this.userProfile.displayName;
    }

    if (this.userProfile.firstName || this.userProfile.lastName) {
      return `${this.userProfile.firstName || ''} ${this.userProfile.lastName || ''}`.trim();
    }

    return this.userProfile.email;
  }

  getStatusDisplay(): string {
    switch (this.userProfile.status) {
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  }

  getStatusBadgeClass(): string {
    switch (this.userProfile.status) {
      case 'active':
        return 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400';
      case 'suspended':
        return 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400';
      default:
        return 'bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400';
    }
  }

  getRoleDisplay(): string {
    if (!this.userProfile.role) return 'User';
    return this.userProfile.role.charAt(0).toUpperCase() + this.userProfile.role.slice(1);
  }

  getRoleBadgeClass(): string {
    switch (this.userProfile.role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-400';
      case 'moderator':
        return 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-400';
      case 'user':
      default:
        return 'bg-tp-bg-light-secondary dark:bg-tp-bg-tertiary text-tp-text-light-primary dark:text-tp-text-primary';
    }
  }

  formatDate(date: Date | string | null): string {
    if (!date) return 'Never';

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  }

  onAvatarError(event: Event): void {
    // Hide broken image and show placeholder
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { UserProfile } from '../../types/profile.types';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-profile-display',
  standalone: true,
  imports: [CommonModule, ButtonComponent, AvatarComponent],
  templateUrl: './profile-display.component.html',
  styleUrl: './profile-display.component.css',
})
export class ProfileDisplayComponent {
  @Input({ required: true }) userProfile!: UserProfile;
  @Input() loading = false;

  @Output() editRequested = new EventEmitter<void>();
  @Output() changePasswordRequested = new EventEmitter<void>();

  getDisplayName(): string {
    if(this.userProfile.displayName) {
      return this.userProfile.displayName;
    }

    if(this.userProfile.firstName || this.userProfile.lastName) {
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
    return `status-badge ${this.userProfile.status}`;
  }

  getRoleDisplay(): string {
    if (!this.userProfile.role) return 'User';
    return this.userProfile.role.charAt(0).toUpperCase() + this.userProfile.role.slice(1);
  }

  getRoleBadgeClass(): string {
    return `role-badge ${this.userProfile.role}`;
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
        minute: '2-digit'
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

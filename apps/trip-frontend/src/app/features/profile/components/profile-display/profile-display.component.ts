import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { Profile } from '@trip-planner/types';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-profile-display',
  standalone: true,
  imports: [CommonModule, ButtonComponent, AvatarComponent],
  templateUrl: './profile-display.component.html',
  styleUrl: './profile-display.component.css',
})
export class ProfileDisplayComponent {
  @Input({ required: true}) profile!: Profile;
  @Input() loading = false;

  @Output() editRequested = new EventEmitter<void>();
  @Output() changePasswordRequested = new EventEmitter<void>();

  getDisplayName(): string {
    if(this.profile.displayName) {
      return this.profile.displayName;
    }

    if(this.profile.firstName || this.profile.lastName) {
      return `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
    }

    return 'No Name';
  }

  getStatusDisplay(): string {
    switch (this.profile.status) {
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
    return `status-badge ${this.profile.status}`;
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

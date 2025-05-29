import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css'
})
export class AvatarComponent {
  @Input() src: string | null = null;
  @Input() alt = 'User avatar';
  @Input() size: AvatarSize = 'md';
  @Input() clickable = false;
  @Input() showBorder = true;
  @Input() loading = false;

  @Output() avatarClick = new EventEmitter<void>();

  public imageError = false;

  get avatarClasses(): string {
    const baseClasses = 'avatar';
    const sizeClass = `avatar-${this.size}`;
    const borderClass = this.showBorder ? 'avatar-border' : '';
    const clickableClass = this.clickable ? 'avatar-clickable' : '';
    const loadingClass = this.loading ? 'avatar-loading' : '';

    return [baseClasses, sizeClass, borderClass, clickableClass, loadingClass]
      .filter(Boolean)
      .join(' ');
  }

  get placeholderClasses(): string {
    const baseClasses = 'avatar-placeholder';
    const sizeClass = `avatar-${this.size}`;
    const borderClass = this.showBorder ? 'avatar-border' : '';
    const clickableClass = this.clickable ? 'avatar-clickable' : '';
    const loadingClass = this.loading ? 'avatar-loading' : '';

    return [baseClasses, sizeClass, borderClass, clickableClass, loadingClass]
      .filter(Boolean)
      .join(' ');
  }

  get iconSize(): string {
    switch (this.size) {
      case 'xs':
        return 'w-3 h-3';
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-6 h-6';
      case 'lg':
        return 'w-8 h-8';
      case 'xl':
        return 'w-12 h-12';
      default:
        return 'w-6 h-6';
    }
  }

  onImageError(): void {
    this.imageError = true;
  }

  onImageLoad(): void {
    this.imageError = false;
  }

  onClick(): void {
    if (this.clickable && !this.loading) {
      this.avatarClick.emit();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.clickable && !this.loading && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.avatarClick.emit();
    }
  }
}

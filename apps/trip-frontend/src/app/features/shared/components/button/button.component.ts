import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;

  @Output() buttonClick = new EventEmitter<Event>();

  get buttonClasses(): string {
    const baseClasses = 'btn';

    const variantClass = `btn-${this.variant}`;
    const sizeClass = `btn-${this.size}`;
    const widthClass = this.fullWidth ? 'btn-full-width' : '';
    const loadingClass = this.loading ? 'btn-loading' : '';

    return [baseClasses, variantClass, sizeClass, widthClass, loadingClass]
      .filter(Boolean)
      .join(' ');
  }

  onClick(event: Event): void {
    if (!this.disabled && !this.loading) {
      this.buttonClick.emit(event);
    }
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';

export type FABPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';
export type FABSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-floating-action-button',
  templateUrl: './floating-action-button.component.html',
  styleUrls: ['./floating-action-button.component.css'],
  standalone: true,
  imports: [],
})
export class FloatingActionButtonComponent {
  @Input() position: FABPosition = 'bottom-right';
  @Input() size: FABSize = 'md';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() icon?: string;
  @Input() text?: string;
  @Input() ariaLabel?: string;

  @Output() buttonClick = new EventEmitter<Event>();

  get fabClasses(): string {
    const baseClasses = 'fab';
    
    const positionClass = `fab-${this.position}`;
    const sizeClass = `fab-${this.size}`;
    const loadingClass = this.loading ? 'fab-loading' : '';
    const withTextClass = this.text ? 'fab-with-text' : 'fab-icon-only';

    return [baseClasses, positionClass, sizeClass, loadingClass, withTextClass]
      .filter(Boolean)
      .join(' ');
  }

  onClick(event: Event): void {
    if (!this.disabled && !this.loading) {
      this.buttonClick.emit(event);
    }
  }
}
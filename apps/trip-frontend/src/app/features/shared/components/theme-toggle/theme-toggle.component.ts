import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../../core/services/theme.service';

@Component({
  standalone: true,
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      (click)="toggleTheme()"
      class="theme-toggle-btn"
      [attr.aria-label]="
        themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      "
      title="{{ themeService.theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }}"
    >
      @if (themeService.theme() === 'dark') {
        <!-- Sun icon for light mode -->
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      } @else {
        <!-- Moon icon for dark mode -->
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      }
    </button>
  `,
  styles: [
    `
      .theme-toggle-btn {
        @apply p-2 rounded-lg border-0 bg-transparent text-tp-text-light-primary dark:text-tp-text-primary hover:bg-tp-bg-light-secondary dark:hover:bg-tp-bg-tertiary transition-colors cursor-pointer;
      }

      .theme-toggle-btn:focus {
        @apply outline-none ring-2 ring-tp-orange ring-offset-2;
      }

      .theme-toggle-btn svg {
        @apply block;
      }
    `,
  ],
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);

  toggleTheme(): void {
    const newTheme = this.themeService.toggleTheme();
    // Save to localStorage so it persists across reloads
    localStorage.setItem('theme', newTheme);
  }
}

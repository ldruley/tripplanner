import { Injectable, signal, Signal, WritableSignal, inject } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly localStorage = inject(LocalStorageService);
  private readonly THEME_KEY = 'theme';

  private readonly currentTheme: WritableSignal<Theme> = signal<Theme>('light');

  // Public readonly signal
  public readonly theme: Signal<Theme> = this.currentTheme.asReadonly();

  constructor() {
    // This will be called by APP_INITIALIZER
  }

  /**
   * Initialize theme from localStorage or OS preference
   * This should be called early in app bootstrap
   * Note: The theme is already applied to the DOM by inline script in index.html
   */
  initializeTheme(): void {
    const theme = this.getInitialTheme();
    // Only update the signal, don't apply to DOM since it's already applied
    this.currentTheme.set(theme);
  }

  /**
   * Set the current theme and apply it to the document
   */
  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    this.applyThemeToDocument(theme);
    // Note: We don't save to localStorage here - that's handled by the app lifecycle
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): Theme {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Get current theme value
   */
  getCurrentTheme(): Theme {
    return this.currentTheme();
  }

  /**
   * Update theme in localStorage (called by other services/components)
   */
  updateThemeInStorage(theme: Theme): void {
    this.localStorage.set(this.THEME_KEY, theme);
    this.setTheme(theme);
  }

  private getInitialTheme(): Theme {
    // First check localStorage
    const savedTheme = this.localStorage.get<Theme>(this.THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    // Fall back to OS preference
    return this.getOSThemePreference();
  }

  private getOSThemePreference(): Theme {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  private applyThemeToDocument(theme: Theme): void {
    if (typeof document !== 'undefined') {
      const htmlElement = document.documentElement;
      if (theme === 'dark') {
        htmlElement.classList.add('dark');
      } else {
        htmlElement.classList.remove('dark');
      }
    }
  }

}

import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UpdateUserSettings } from '@trip-planner/types';
import { Subject, of } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { LocalStorageService } from '../../../core/services/local-storage.service';
import { ThemeService } from '../../../core/services/theme.service';

export interface SettingsState {
  settings: UpdateUserSettings | null;
  loading: boolean;
  error: string | null;
}

export interface CachedUserSettings {
  settings: UpdateUserSettings;
  lastSynced: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly localStorage = inject(LocalStorageService);
  private readonly themeService = inject(ThemeService);
  private readonly backendApiUrl = environment.backendApiUrl;
  private readonly SETTINGS_CACHE_KEY = 'user_settings';

  // Internal State Signals
  private readonly settings: WritableSignal<UpdateUserSettings | null> = signal(null);
  private readonly isLoading = signal(false);
  private readonly error = signal<string | null>(null);

  // Subjects for Async tasks
  private readonly loadRequest$ = new Subject<void>();
  private readonly updateRequest$ = new Subject<UpdateUserSettings>();

  // Expose a comprehensive state object
  public readonly state$: Signal<SettingsState> = computed(() => ({
    settings: this.settings(),
    loading: this.isLoading(),
    error: this.error(),
  }));

  constructor() {
    // RxJS Load Settings
    this.loadRequest$
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.error.set(null);
        }),
        switchMap(() => {
          // Check localStorage first
          const cached = this.getCachedSettings();
          if (cached) {
            this.settings.set(cached.settings);
            this.isLoading.set(false);
            return of(cached.settings);
          }

          // Fall back to API
          return this.http.get<UpdateUserSettings>(`${this.backendApiUrl}/user-settings`).pipe(
            tap(settings => {
              this.settings.set(settings);
              this.setCachedSettings(settings);
              this.syncTheme(settings);
            }),
            catchError(err => {
              this.error.set(this.getErrorMessage(err));
              return of(null);
            }),
            tap(() => this.isLoading.set(false)),
          );
        }),
      )
      .subscribe();

    // RxJS Update Settings
    this.updateRequest$
      .pipe(
        tap(() => {
          this.isLoading.set(true);
          this.error.set(null);
        }),
        switchMap(payload =>
          this.http.put<void>(`${this.backendApiUrl}/user-settings`, payload).pipe(
            tap(() => {
              this.settings.set(payload);
              this.setCachedSettings(payload);
              this.syncTheme(payload);
            }),
            catchError(err => {
              this.error.set(this.getErrorMessage(err));
              return of(null);
            }),
            tap(() => this.isLoading.set(false)),
          ),
        ),
      )
      .subscribe();
  }

  // ---- Public API ----
  loadSettings(): void {
    this.loadRequest$.next();
  }

  updateSettings(settings: UpdateUserSettings): void {
    this.updateRequest$.next(settings);
  }

  clearError(): void {
    this.error.set(null);
  }

  loadSettingsFromCache(): UpdateUserSettings | null {
    const cached = this.getCachedSettings();
    if (cached) {
      this.settings.set(cached.settings);
      this.syncTheme(cached.settings);
      return cached.settings;
    }
    return null;
  }

  clearSettingsCache(): void {
    this.localStorage.remove(this.SETTINGS_CACHE_KEY);
    this.settings.set(null);
  }

  private getCachedSettings(): CachedUserSettings | null {
    return this.localStorage.get<CachedUserSettings>(this.SETTINGS_CACHE_KEY);
  }

  private setCachedSettings(settings: UpdateUserSettings): void {
    const cached: CachedUserSettings = {
      settings,
      lastSynced: new Date().toISOString(),
    };
    this.localStorage.set(this.SETTINGS_CACHE_KEY, cached);
  }

  private syncTheme(settings: UpdateUserSettings): void {
    if (settings.darkMode !== undefined) {
      const theme = settings.darkMode ? 'dark' : 'light';
      this.themeService.updateThemeInStorage(theme);
    }
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'Invalid settings data.';
      case 401:
        return 'Unauthorized.';
      case 403:
        return 'Forbidden.';
      case 404:
        return 'Settings not found.';
      case 422:
        return error.error?.message || 'Validation error.';
      case 500:
        return 'Server error.';
      default:
        return 'Failed to load settings.';
    }
  }
}

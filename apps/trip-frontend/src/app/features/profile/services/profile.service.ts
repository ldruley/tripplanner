import { Injectable, Signal, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../auth/services/auth.service';
import { Profile, UpdateProfile } from '@trip-planner/types';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ProfileApiResponse,
  ProfileCacheConfig,
  ProfileState,
  UpdateProfileRequest,
} from '../types/profile.types';

import { Subject, of } from 'rxjs';
import {
  debounceTime,
  switchMap,
  catchError,
  tap,
} from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly backendApiUrl = environment.backendApiUrl;

  // Signals for UI
  private readonly profile: WritableSignal<Profile | null> = signal(null);
  private readonly isLoading = signal(false);
  private readonly error = signal<string | null>(null);
  private readonly isEditing = signal(false);
  private readonly cacheTimestamp = signal(0);
  private readonly authState = toSignal(this.authService.authState$, { initialValue: null });

  // Subjects for Async tasks
  private readonly updateRequest$ = new Subject<UpdateProfileRequest>();
  private readonly refreshTrigger$ = new Subject<void>();

  private readonly cacheConfig: ProfileCacheConfig = {
    ttl: 5 * 60 * 1000,
    maxAge: 30 * 60 * 1000,
  };

  // Computed state for templates or view-model consumption
  public readonly profileState$: Signal<ProfileState> = computed(() => ({
    profile: this.profile(),
    loading: this.isLoading(),
    error: this.error(),
    isEditing: this.isEditing(),
  }));

  public readonly profile$ = computed(() => this.profile());
  public readonly loading$ = computed(() => this.isLoading());
  public readonly error$ = computed(() => this.error());
  public readonly isEditing$ = computed(() => this.isEditing());

  constructor() {
    effect(() => {
      const auth = this.authState();
      if (auth?.user) {
        this.loadProfileIfStale();
      } else {
        this.clearCache();
      }
    });

    // RxJS Profile Updates
    this.updateRequest$
      .pipe(
        debounceTime(300),
        tap(() => {
          this.isLoading.set(true);
          this.error.set(null);
        }),
        switchMap((payload) =>
          this.http.put<ProfileApiResponse>(`${this.backendApiUrl}/profiles/me`, payload).pipe(
            tap((res) => {
              this.profile.set(res.data);
              this.cacheTimestamp.set(Date.now());
              this.isEditing.set(false);
            }),
            catchError((err) => {
              this.error.set(this.getErrorMessage(err));
              return of(null);
            }),
            tap(() => this.isLoading.set(false))
          )
        )
      )
      .subscribe();

    // RxJS Refresh
    this.refreshTrigger$
      .pipe(
        tap(() => {
          console.log('🔄 Profile refresh triggered');
          this.isLoading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.http.get<ProfileApiResponse>(`${this.backendApiUrl}/profiles/me`).pipe(
            tap((res) => {
              console.log('✅ Response received:', res);
              this.profile.set(res.data);
              this.cacheTimestamp.set(Date.now());
            }),
            catchError((err) => {
              console.error('❌ HTTP Error:', err);
              this.error.set(this.getErrorMessage(err));
              return of(null);
            }),
            tap(() => this.isLoading.set(false))
          )
        )
      )
      .subscribe();
  }

  // ---- Public API ----

  getCurrentProfileSync(): Profile | null {
    return this.profile();
  }

  refreshProfile(): void {
    this.refreshTrigger$.next();
  }

  updateProfile(payload: UpdateProfileRequest): void {
    this.updateRequest$.next(payload);
  }

  setEditMode(editing: boolean): void {
    this.isEditing.set(editing);
  }

  clearCache(): void {
    this.profile.set(null);
    this.cacheTimestamp.set(0);
    this.error.set(null);
    this.isEditing.set(false);
  }

  private loadProfileIfStale(): void {
    const now = Date.now();
    const lastFetch = this.cacheTimestamp();
    const isStale = now - lastFetch > this.cacheConfig.ttl;

    if (!isStale) return;

    this.refreshProfile();
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'Invalid profile data.';
      case 401:
        return 'Unauthorized.';
      case 403:
        return 'Forbidden.';
      case 404:
        return 'Not found.';
      case 422:
        return error.error?.message || 'Validation error.';
      case 500:
        return 'Server error.';
      default:
        return 'Unexpected error.';
    }
  }
}

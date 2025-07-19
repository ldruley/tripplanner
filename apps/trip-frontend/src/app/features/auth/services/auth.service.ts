import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

import {
  CreateUser,
  LoginUser,
  SafeUser,
  ChangePassword,
  VerifyEmail,
  ResendVerification,
  AuthResponse,
} from '@trip-planner/types';

import { environment } from '../../../../environments/environment';
import { SettingsService } from '../../settings/services/settings.service';
import { ThemeService } from '../../../core/services/theme.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends LoginCredentials {
  firstName: string;
  lastName: string;
}

export interface ChangePasswordCredentials {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Define the shape of the decoded JWT payload from your backend
interface JwtPayload {
  sub: string;
  email: string;
  roles: string;
  iat: number;
  exp: number;
}

// Update AuthState to use SafeUser
export interface AuthState {
  user: SafeUser | null;
  loading: boolean;
  error: string | null;
  isRefreshing: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly apiUrl = `${environment.backendApiUrl}/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private refreshInProgress$ = new BehaviorSubject<boolean>(false);

  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    loading: true,
    error: null,
    isRefreshing: false,
  });

  public authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.initializeAuth();
    this.startTokenRefreshTimer();
  }

  private async initializeAuth(): Promise<void> {
    const token = localStorage.getItem(this.TOKEN_KEY);

    if (token) {
      try {
        const decodedToken = jwtDecode<JwtPayload>(token);
        // Check if token is expired
        if (decodedToken.exp * 1000 > Date.now()) {
          const user = this.mapPayloadToSafeUser(decodedToken);
          this.authStateSubject.next({ user, loading: false, error: null, isRefreshing: false });
        } else {
          // Token is expired, try to refresh using cookie
          await this.attemptTokenRefresh();
        }
      } catch (error) {
        // Invalid token, try refresh using cookie
        await this.attemptTokenRefresh();
      }
    } else {
      // No access token, try to refresh using cookie (silent attempt)
      try {
        await this.attemptTokenRefresh();
      } catch (error) {
        // If refresh fails, user is not logged in
        this.authStateSubject.next({
          user: null,
          loading: false,
          error: null,
          isRefreshing: false,
        });
      }
    }
  }

  signIn(credentials: LoginUser): Observable<{ success: boolean; error?: string }> {
    this.setLoading(true);
    return this.http
      .post<Omit<AuthResponse, 'refresh_token'>>(`${this.apiUrl}/login`, credentials, {
        withCredentials: true, // Ensure cookies are sent/received
      })
      .pipe(
        tap(response => {
          this.handleSuccessfulAuthentication(response.access_token);
        }),
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Invalid email or password';
          this.setError(message);
          return of({ success: false, error: message });
        }),
      );
  }

  signUp(
    credentials: Omit<CreateUser, 'darkMode'>,
  ): Observable<{ success: boolean; error?: string }> {
    this.setLoading(true);

    // Detect system theme preference and include it in registration
    const systemPrefersDark = this.detectSystemThemePreference();
    const credentialsWithTheme: CreateUser = {
      ...credentials,
      darkMode: systemPrefersDark,
    };

    return this.http.post<SafeUser>(`${this.apiUrl}/register`, credentialsWithTheme).pipe(
      tap(() => {
        // On successful registration, set loading to false. The user needs to login separately.
        this.setLoading(false);
      }),
      map(() => ({ success: true })),
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || 'An error occurred during registration.';
        this.setError(message);
        return of({ success: false, error: message });
      }),
    );
  }

  signOut(): void {
    // Call the backend to revoke refresh token and clear cookie
    this.http
      .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(catchError(() => of(null)))
      .subscribe();

    localStorage.removeItem(this.TOKEN_KEY);
    // Clear settings cache on logout
    this.settingsService.clearSettingsCache();
    this.authStateSubject.next({ user: null, loading: false, error: null, isRefreshing: false });
    this.router.navigate(['/auth/login']);
  }

  private handleSuccessfulAuthentication(token: string, isRefresh: boolean = false): void {
    localStorage.setItem(this.TOKEN_KEY, token);

    const decodedToken = jwtDecode<JwtPayload>(token);
    const user = this.mapPayloadToSafeUser(decodedToken);
    this.authStateSubject.next({ user, loading: false, error: null, isRefreshing: false });

    // Load settings from database and cache them
    this.settingsService.loadSettings();

    // Only handle redirect if this isn't a token refresh
    if (!isRefresh) {
      this.handleRedirect();
    }
  }

  private handleRedirect(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl');
    if (returnUrl && returnUrl !== '/auth/login') {
      this.router.navigateByUrl(returnUrl);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // Helper to map JWT payload to our SafeUser type
  private mapPayloadToSafeUser(payload: JwtPayload): SafeUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.roles as SafeUser['role'],
      emailVerified: true, // If user has a valid JWT, they must be verified
      createdAt: new Date(0), // Placeholder
      updatedAt: new Date(0), // Placeholder
    };
  }

  verifyEmail(token: string): Observable<{ success: boolean; error?: string }> {
    const verifyData: VerifyEmail = { token };
    return this.http.post<{ message: string }>(`${this.apiUrl}/verify-email`, verifyData).pipe(
      map(() => ({ success: true })),
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.message || 'Email verification failed';
        return of({ success: false, error: message });
      }),
    );
  }

  resendVerificationEmail(email: string): Observable<{ success: boolean; error?: string }> {
    const resendData: ResendVerification = { email };
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/resend-verification`, resendData)
      .pipe(
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Failed to resend verification email';
          return of({ success: false, error: message });
        }),
      );
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    console.warn('resetPassword functionality requires a backend endpoint.');
    return { success: false, error: 'Not implemented' };
  }

  async updatePassword(credentials: ChangePassword): Promise<{ success: boolean; error?: string }> {
    console.warn('updatePassword functionality requires a backend endpoint.');
    return { success: false, error: 'Not implemented' };
  }

  getCurrentUser(): SafeUser | null {
    return this.authStateSubject.value.user;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.user !== null;
  }

  public isCurrentlyLoading(): boolean {
    return this.authStateSubject.value.loading;
  }

  private setLoading(loading: boolean): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading,
      error: loading ? null : currentState.error,
    });
  }

  private setRefreshing(isRefreshing: boolean): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      isRefreshing,
    });
    this.refreshInProgress$.next(isRefreshing);
  }

  private setError(error: string): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading: false,
      error,
    });
  }

  /**
   * Refresh the access token using the HTTP-only cookie
   */
  refreshTokens(): Observable<Omit<AuthResponse, 'refresh_token'>> {
    this.setRefreshing(true);
    return this.http
      .post<Omit<AuthResponse, 'refresh_token'>>(
        `${this.apiUrl}/refresh`,
        {},
        {
          withCredentials: true, // Ensure refresh token cookie is sent
        },
      )
      .pipe(
        tap(response => {
          this.handleSuccessfulAuthentication(response.access_token, true);
          this.setRefreshing(false);
        }),
        catchError(err => {
          this.setRefreshing(false);
          this.signOut(); // Refresh failed, sign out user
          throw err;
        }),
      );
  }

  /**
   * Check if the current token is expired
   */
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const decodedToken = jwtDecode<JwtPayload>(token);
      return decodedToken.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Check if the current token is expiring soon (within 5 minutes)
   */
  isTokenExpiringSoon(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const decodedToken = jwtDecode<JwtPayload>(token);
      const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
      return decodedToken.exp * 1000 <= fiveMinutesFromNow;
    } catch {
      return true;
    }
  }

  /**
   * Get observable for refresh in progress state
   */
  getRefreshInProgress$(): Observable<boolean> {
    return this.refreshInProgress$.asObservable();
  }

  /**
   * Attempt to refresh token during initialization
   */
  private async attemptTokenRefresh(): Promise<void> {
    try {
      await this.refreshTokens().toPromise();
    } catch (error) {
      // Silently fail during initialization - user is not logged in
      this.authStateSubject.next({ user: null, loading: false, error: null, isRefreshing: false });
    }
  }

  /**
   * Start a timer to proactively refresh tokens before they expire
   */
  private startTokenRefreshTimer(): void {
    // Check every minute if token needs refresh
    setInterval(() => {
      if (this.isAuthenticated() && !this.refreshInProgress$.value) {
        if (this.isTokenExpiringSoon() && !this.isTokenExpired()) {
          this.refreshTokens().subscribe({
            error: () => {
              // If refresh fails, the error handling in refreshTokens() will sign out the user
            },
          });
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Detect system theme preference for new user registration
   */
  private detectSystemThemePreference(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false; // Default to light mode if unable to detect
  }
}

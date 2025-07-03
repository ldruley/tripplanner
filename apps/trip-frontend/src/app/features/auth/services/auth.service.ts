import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { jwtDecode } from 'jwt-decode';

import { CreateUser, LoginUser, SafeUser, ChangePassword, VerifyEmail, ResendVerification } from '@trip-planner/types';

import { environment } from '../../../../environments/environment';
import { SettingsService } from '../../settings/services/settings.service';

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
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);
  private readonly apiUrl = `${environment.backendApiUrl}/auth`;
  private readonly TOKEN_KEY = 'auth_token';

  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  public authState$ = this.authStateSubject.asObservable();

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (token) {
      try {
        const decodedToken = jwtDecode<JwtPayload>(token);
        // Check if token is expired
        if (decodedToken.exp * 1000 > Date.now()) {
          const user = this.mapPayloadToSafeUser(decodedToken);
          this.authStateSubject.next({ user, loading: false, error: null });
        } else {
          // Token is expired, clear it
          this.signOut();
        }
      } catch (error) {
        // Invalid token, clear it
        this.signOut();
      }
    } else {
      this.authStateSubject.next({ user: null, loading: false, error: null });
    }
  }

  signIn(credentials: LoginUser): Observable<{ success: boolean; error?: string }> {
    this.setLoading(true);
    return this.http.post<{ access_token: string }>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          this.handleSuccessfulAuthentication(response.access_token);
        }),
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Invalid email or password';
          this.setError(message);
          return of({ success: false, error: message });
        })
      );
  }

  signUp(credentials: CreateUser): Observable<{ success: boolean; error?: string }> {
    this.setLoading(true);
    return this.http.post<SafeUser>(`${this.apiUrl}/register`, credentials)
      .pipe(
        tap(() => {
          // On successful registration, set loading to false. The user needs to login separately.
          this.setLoading(false);
        }),
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'An error occurred during registration.';
          this.setError(message);
          return of({ success: false, error: message });
        })
      );
  }

  signOut(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    // Clear settings cache on logout
    this.settingsService.clearSettingsCache();
    this.authStateSubject.next({ user: null, loading: false, error: null });
    this.router.navigate(['/auth/login']);
  }

  private handleSuccessfulAuthentication(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    const decodedToken = jwtDecode<JwtPayload>(token);
    const user = this.mapPayloadToSafeUser(decodedToken);
    this.authStateSubject.next({ user, loading: false, error: null });
    
    // Load settings from database and cache them
    this.settingsService.loadSettings();
    
    this.handleRedirect();
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
    return this.http.post<{ message: string }>(`${this.apiUrl}/verify-email`, verifyData)
      .pipe(
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Email verification failed';
          return of({ success: false, error: message });
        })
      );
  }

  resendVerificationEmail(email: string): Observable<{ success: boolean; error?: string }> {
    const resendData: ResendVerification = { email };
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-verification`, resendData)
      .pipe(
        map(() => ({ success: true })),
        catchError((err: HttpErrorResponse) => {
          const message = err.error?.message || 'Failed to resend verification email';
          return of({ success: false, error: message });
        })
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
      error: loading ? null : currentState.error
    });
  }

  private setError(error: string): void {
    const currentState = this.authStateSubject.value;
    this.authStateSubject.next({
      ...currentState,
      loading: false,
      error
    });
  }
}

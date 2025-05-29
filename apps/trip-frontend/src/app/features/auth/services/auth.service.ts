import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User, AuthError } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends LoginCredentials {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordCredentials {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);
  private supabase: SupabaseClient;

  private authStateSubject = new BehaviorSubject<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  public authState$ = this.authStateSubject.asObservable();
  private sessionSubject = new BehaviorSubject<any>(null);
  public session$ = this.sessionSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();

      this.authStateSubject.next({
        user: session?.user ?? null,
        loading: false,
        error: null
      });

      this.sessionSubject.next(session);

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.authStateSubject.next({
          user: session?.user ?? null,
          loading: false,
          error: null
        });

        this.sessionSubject.next(session);

        if (event === 'SIGNED_IN') {
          this.handleSuccessfulLogin();
        } else if (event === 'SIGNED_OUT') {
          this.router.navigate(['/auth/login']);
        }
      });
    } catch (error) {
      this.authStateSubject.next({
        user: null,
        loading: false,
        error: 'Failed to initialize authentication'
      });
    }
  }

  private handleSuccessfulLogin(): void {
      // Check for return URL in query params
      const urlParams = new URLSearchParams(window.location.search);
      const returnUrl = urlParams.get('returnUrl');

      if (returnUrl && returnUrl !== '/auth/login') {
        this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }

  async signIn(credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> {
    this.setLoading(true);

    try {
      const { error } = await this.supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) {
        this.setError(this.formatAuthError(error));
        return { success: false, error: this.formatAuthError(error) };
      }

      return { success: true };
    } catch (error) {
      const message = 'An unexpected error occurred during sign in';
      this.setError(message);
      return { success: false, error: message };
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<{ success: boolean; error?: string }> {
    this.setLoading(true);

    try {
      const { error } = await this.supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            first_name: credentials.firstName,
            last_name: credentials.lastName,
            display_name: `${credentials.firstName} ${credentials.lastName}`.trim()
          }
        }
      });

      if (error) {
        this.setError(this.formatAuthError(error));
        return { success: false, error: this.formatAuthError(error) };
      }

      return { success: true };
    } catch (error) {
      const message = 'An unexpected error occurred during sign up';
      this.setError(message);
      return { success: false, error: message };
    }
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);

      if (error) {
        return { success: false, error: this.formatAuthError(error) };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to send reset email' };
    }
  }

  async updatePassword(credentials: ChangePasswordCredentials): Promise<{ success: boolean; error?: string }> {
    try {
      const user = this.getCurrentUser();
      if (!user?.email) {
        return { success: false, error: 'No authenticated user found' };
      }

      const { error: verifyError } = await this.supabase.auth.signInWithPassword({
        email: user.email,
        password: credentials.oldPassword
      });

      if (verifyError) {
        return { success: false, error: 'Current password is incorrect' };
      }

      const { error: updateError } = await this.supabase.auth.updateUser({
        password: credentials.newPassword
      });

      if (updateError) {
        return { success: false, error: this.formatAuthError(updateError) };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update password' };
    }
  }

  getCurrentUser(): User | null {
    return this.authStateSubject.value.user;
  }

  getCurrentSession() {
    return this.sessionSubject.value;
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.user !== null;
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

  private formatAuthError(error: AuthError): string {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password';
      case 'Email not confirmed':
        return 'Please check your email and click the confirmation link';
      case 'User already registered':
        return 'An account with this email already exists';
      default:
        return error.message;
    }
  }
}

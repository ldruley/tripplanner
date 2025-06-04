import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, Subscription } from 'rxjs';

import { EmailVerifiedComponent } from './email-verified.component';
import { AuthService } from '../../services/auth.service';
import { User as AuthUser } from '@supabase/supabase-js';

// Mock for Supabase User
const mockSupabaseUser = (confirmed: boolean, id = '123'): Partial<AuthUser> => ({
  id,
  email: 'test@example.com',
  email_confirmed_at: confirmed ? new Date().toISOString() : undefined,
});

interface AuthState {
  loading: boolean;
  user: Partial<AuthUser> | null;
  error: string | null;
  session: any;
}

class MockAuthService {
  private authState = new BehaviorSubject<AuthState>({
    loading: true,
    user: null,
    error: null,
    session: null,
  });
  authState$ = this.authState.asObservable();
  authStateSubject = this.authState;

  getCurrentUser(): Partial<AuthUser> | null {
    return this.authState.value.user;
  }

  isCurrentlyLoading(): boolean {
    return this.authState.value.loading;
  }

  setAuthState(newState: Partial<AuthState>) {
    this.authState.next({ ...this.authState.value, ...newState });
  }
}

class MockRouter {
  navigate = jest.fn();
}

describe('EmailVerifiedComponent', () => {
  let component: EmailVerifiedComponent;
  let fixture: ComponentFixture<EmailVerifiedComponent>;
  let mockAuthService: MockAuthService;
  let mockRouter: MockRouter;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailVerifiedComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmailVerifiedComponent);
    component = fixture.componentInstance;
    mockAuthService = TestBed.inject(AuthService) as unknown as MockAuthService;
    mockRouter = TestBed.inject(Router) as unknown as MockRouter;
  });

  it('should create', () => {
    fixture.detectChanges(); // Ensure ngOnInit runs if needed for basic creation check
    expect(component).toBeTruthy();
  });

  it('should initialize with loading state and then reflect auth service state', () => {
    // Initial component defaults
    expect(component.isLoading).toBe(true);
    expect(component.verificationStatus).toBe('verifying');

    // Simulate auth service being in a loading state
    mockAuthService.setAuthState({ loading: true, user: null, error: null });
    fixture.detectChanges();

    expect(component.isLoading).toBe(true);
    expect(component.verificationStatus).toBe('verifying');
  });

  it('should set verificationStatus to "success" if user is confirmed on init (via getCurrentUser)', fakeAsync(() => {
    const user = mockSupabaseUser(true);
    jest.spyOn(mockAuthService, 'getCurrentUser').mockReturnValue(user);
    jest.spyOn(mockAuthService, 'isCurrentlyLoading').mockReturnValue(false);

    fixture.detectChanges();

    expect(component.verificationStatus).toBe('success');
    expect(component.isLoading).toBe(false);
  }));


  it('should transition to "success" when authState emits a confirmed user via subscription', fakeAsync(() => {
    mockAuthService.setAuthState({ loading: true, user: null });
    fixture.detectChanges();

    expect(component.isLoading).toBe(true);
    const confirmedUser = mockSupabaseUser(true);
    mockAuthService.setAuthState({ loading: false, user: confirmedUser, error: null });
    tick(1000);
    fixture.detectChanges();

    expect(component.verificationStatus).toBe('success');
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBeNull();
  }));

  it('should remain "verifying" then transition to "success" if user confirmed after delay via subscription', fakeAsync(() => {
    // Initial state where user is not yet confirmed, and service is not initially "loading"
    mockAuthService.setAuthState({ loading: false, user: mockSupabaseUser(false) });
    fixture.detectChanges();

    tick(1000);
    fixture.detectChanges();
    // Based on component logic, if user exists but not confirmed, status remains 'verifying'
    expect(component.verificationStatus).toBe('verifying');
    expect(component.isLoading).toBe(true); // isLoading becomes true if status is 'verifying'

    // Now emit that the user is confirmed
    mockAuthService.setAuthState({ loading: false, user: mockSupabaseUser(true) });
    tick(1000);
    fixture.detectChanges();

    expect(component.verificationStatus).toBe('success');
    expect(component.isLoading).toBe(false);
  }));

  it('should transition to "error" when authState emits an error via subscription', fakeAsync(() => {
    mockAuthService.setAuthState({ loading: true, user: null });
    fixture.detectChanges();

    mockAuthService.setAuthState({ loading: false, user: null, error: 'Auth Error Occurred' });
    tick(1000);
    fixture.detectChanges();

    expect(component.verificationStatus).toBe('error');
    expect(component.isLoading).toBe(false);
    expect(component.errorMessage).toBe('Auth Error Occurred');
  }));

  it('should unsubscribe from authSubscription on ngOnDestroy', () => {
    fixture.detectChanges();

    const actualSubscription = (component as any).authSubscription;
    // Ensure there is a subscription to spy on
    if (actualSubscription) {
      jest.spyOn(actualSubscription, 'unsubscribe');
      component.ngOnDestroy();
      expect(actualSubscription.unsubscribe).toHaveBeenCalled();
    } else {
      fail('authSubscription was not initialized by ngOnInit');
    }
  });

  it('should navigate to login on navigateToLogin()', () => {
    component.navigateToLogin();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should navigate to dashboard on navigateToDashboard()', () => {
    component.navigateToDashboard();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  describe('DOM interactions', () => {
    it('should display loading spinner when isLoading is true', fakeAsync(() => {
      mockAuthService.setAuthState({ loading: true, user: null });
      fixture.detectChanges();
      tick(1000);
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('svg.animate-spin');
      expect(spinner).toBeTruthy();
      const successMessage = fixture.nativeElement.querySelector('h2.text-green-500');
      expect(successMessage).toBeFalsy();
    }));

    it('should display success message when verificationStatus is "success"', fakeAsync(() => {
      mockAuthService.setAuthState({ loading: false, user: mockSupabaseUser(true) });
      fixture.detectChanges();
      tick(1000);
      fixture.detectChanges();

      const successTitle = fixture.nativeElement.querySelector('h2');
      expect(successTitle.textContent).toContain('Email Verified!'); // From your HTML
      const continueButton = fixture.nativeElement.querySelector('button');
      expect(continueButton.textContent).toContain('Continue to Dashboard');
    }));

    it('should display error message when verificationStatus is "error"', fakeAsync(() => {
      mockAuthService.setAuthState({ loading: false, user: null, error: 'Custom Error From Test' });
      fixture.detectChanges();
      tick(1000);
      fixture.detectChanges();

      const errorTitle = fixture.nativeElement.querySelector('h2');
      expect(errorTitle.textContent).toContain('Verification Failed');
      const errorMessageParagraph = fixture.nativeElement.querySelector('p.text-gray-600');
      expect(errorMessageParagraph.textContent).toContain('Custom Error From Test');
      const backButton = fixture.nativeElement.querySelector('button');
      expect(backButton.textContent).toContain('Back to Login');
    }));
  });
});

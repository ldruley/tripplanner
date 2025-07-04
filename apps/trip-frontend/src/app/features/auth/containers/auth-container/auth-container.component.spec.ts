import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AuthContainerComponent } from './auth-container.component';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

describe('AuthContainerComponent', () => {
  let component: AuthContainerComponent;
  let fixture: ComponentFixture<AuthContainerComponent>;

  const mockAuthService = {
    authState$: of({ user: null, loading: false, error: null }),
    signUp: jest.fn(() => of({ success: true })),
    signIn: jest.fn(() => of({ success: true })),
    resetPassword: jest.fn(() => Promise.resolve({ success: true })),
    updatePassword: jest.fn(() => Promise.resolve({ success: true }))
  };

  const mockRouter = {
    navigate: jest.fn(() => Promise.resolve(true))
  };

  const mockActivatedRoute = {
    url: of([{ path: 'login' }])
  };

  const mockToastService = {
    showSuccess: jest.fn(),
    showError: jest.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthContainerComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

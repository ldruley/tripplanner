import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RegisterContainerComponent } from './register-container.component';
import { AuthService } from '../../services/auth.service';

describe('RegisterContainerComponent', () => {
  let component: RegisterContainerComponent;
  let fixture: ComponentFixture<RegisterContainerComponent>;

  const mockAuthService = {
    authState$: of({ user: null, loading: false, error: null }),
    signUp: jest.fn(() => of({ success: true })),
    resendVerificationEmail: jest.fn(() => of({ success: true }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterContainerComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

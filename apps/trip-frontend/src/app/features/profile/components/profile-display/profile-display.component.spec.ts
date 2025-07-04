import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileDisplayComponent } from './profile-display.component';
import { UserProfile } from '../../types/profile.types';
import { UserStatus } from '@trip-planner/types';

describe('ProfileDisplayComponent', () => {
  let component: ProfileDisplayComponent;
  let fixture: ComponentFixture<ProfileDisplayComponent>;

  const mockUserProfile: UserProfile = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    firstName: 'John',
    lastName: 'Doe',
    displayName: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
    lastSignInAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    onboardingCompleted: true,
    email: 'john.doe@example.com',
    role: 'user' as const
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileDisplayComponent);
    component = fixture.componentInstance;
    component.userProfile = mockUserProfile;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileDisplayComponent } from './profile-display.component';

describe('ProfileDisplayComponent', () => {
  let component: ProfileDisplayComponent;
  let fixture: ComponentFixture<ProfileDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileDisplayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

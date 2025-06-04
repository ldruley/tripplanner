import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripContainerComponent } from './trip-container.component';

describe('TripContainerComponent', () => {
  let component: TripContainerComponent;
  let fixture: ComponentFixture<TripContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TripContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

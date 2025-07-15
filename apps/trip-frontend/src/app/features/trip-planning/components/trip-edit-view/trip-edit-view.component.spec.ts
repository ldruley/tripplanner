import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripEditViewComponent } from './trip-edit-view.component';

describe('TripEditViewComponent', () => {
  let component: TripEditViewComponent;
  let fixture: ComponentFixture<TripEditViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripEditViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TripEditViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

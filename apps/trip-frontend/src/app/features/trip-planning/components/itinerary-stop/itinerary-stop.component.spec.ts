import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItineraryStopComponent } from './itinerary-stop.component';

describe('ItineraryStopComponent', () => {
  let component: ItineraryStopComponent;
  let fixture: ComponentFixture<ItineraryStopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItineraryStopComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ItineraryStopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

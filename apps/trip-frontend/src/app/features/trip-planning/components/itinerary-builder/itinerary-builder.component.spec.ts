import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItineraryBuilderComponent } from './itinerary-builder.component';

describe('ItineraryBuilderComponent', () => {
  let component: ItineraryBuilderComponent;
  let fixture: ComponentFixture<ItineraryBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItineraryBuilderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ItineraryBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

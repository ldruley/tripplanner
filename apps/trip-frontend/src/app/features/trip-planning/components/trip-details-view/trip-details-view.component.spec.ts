import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripDetailsViewComponent } from './trip-details-view.component';

describe('TripDetailsViewComponent', () => {
  let component: TripDetailsViewComponent;
  let fixture: ComponentFixture<TripDetailsViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripDetailsViewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TripDetailsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle edit trip details click', () => {
    spyOn(console, 'log');
    component.onEditTripDetails();
    expect(console.log).toHaveBeenCalledWith('Edit trip details clicked');
  });

  it('should handle trip settings click', () => {
    spyOn(console, 'log');
    component.onTripSettings();
    expect(console.log).toHaveBeenCalledWith('Trip settings clicked');
  });

  it('should handle export trip click', () => {
    spyOn(console, 'log');
    component.onExportTrip();
    expect(console.log).toHaveBeenCalledWith('Export trip clicked');
  });

  it('should handle share trip click', () => {
    spyOn(console, 'log');
    component.onShareTrip();
    expect(console.log).toHaveBeenCalledWith('Share trip clicked');
  });
});
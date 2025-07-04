import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItineraryBuilderComponent } from './itinerary-builder.component';
import { Stop } from '../../models/stop.model';

describe('ItineraryBuilderComponent', () => {
  let component: ItineraryBuilderComponent;
  let fixture: ComponentFixture<ItineraryBuilderComponent>;

  const mockStops: Stop[] = [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tripId: '123e4567-e89b-12d3-a456-426614174001',
      order: 0,
      arrivalTime: new Date(),
      departureTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      locationId: '123e4567-e89b-12d3-a456-426614174002',
      locationDetails: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Location',
        description: 'A test location',
        latitude: 40.7128,
        longitude: -74.0060,
        fullAddress: '123 Test St, Test City, NY 10001',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'NY',
        country: 'USA',
        postalCode: '10001',
        geocodingProvider: 'mapbox',
        geocodingProviderId: 'test-id',
        geocodedAt: new Date()
      }
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItineraryBuilderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ItineraryBuilderComponent);
    component = fixture.componentInstance;
    
    // Set required inputs
    fixture.componentRef.setInput('itineraryStops', mockStops);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

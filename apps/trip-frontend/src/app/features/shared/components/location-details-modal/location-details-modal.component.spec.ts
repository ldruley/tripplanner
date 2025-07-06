import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationDetailsModalComponent } from './location-details-modal.component';
import { Location } from '@trip-planner/types';

describe('LocationDetailsModalComponent', () => {
  let component: LocationDetailsModalComponent;
  let fixture: ComponentFixture<LocationDetailsModalComponent>;

  const mockLocation: Location = {
    id: '1',
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
    geocodingProvider: 'google',
    geocodingProviderId: 'ChIJ123',
    geocodedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDetailsModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LocationDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('location', mockLocation);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display location name', () => {
    const nameElement = fixture.nativeElement.querySelector('[id="modal-title"]');
    expect(nameElement.textContent).toContain('Location Details');
  });

  it('should emit close event when close button is clicked', () => {
    spyOn(component.closeModal, 'emit');
    const closeButton = fixture.nativeElement.querySelector('button[aria-label="Close modal"]');
    closeButton.click();
    expect(component.closeModal.emit).toHaveBeenCalled();
  });

  it('should display full address when available', () => {
    expect(component.fullAddress()).toBe('123 Test St, Test City, NY 10001');
  });

  it('should format geocoding provider correctly', () => {
    expect(component.geocodingProviderDisplay()).toBe('Google');
  });

  it('should close modal when backdrop is clicked', () => {
    spyOn(component.closeModal, 'emit');
    const backdrop = fixture.nativeElement.querySelector('.fixed');
    const event = new MouseEvent('click');
    Object.defineProperty(event, 'target', { value: backdrop });
    Object.defineProperty(event, 'currentTarget', { value: backdrop });
    backdrop.dispatchEvent(event);
    expect(component.closeModal.emit).toHaveBeenCalled();
  });
});
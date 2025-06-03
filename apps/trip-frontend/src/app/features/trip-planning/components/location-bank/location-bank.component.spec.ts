import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationBankComponent } from './location-bank.component';

describe('LocationBankComponent', () => {
  let component: LocationBankComponent;
  let fixture: ComponentFixture<LocationBankComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationBankComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LocationBankComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

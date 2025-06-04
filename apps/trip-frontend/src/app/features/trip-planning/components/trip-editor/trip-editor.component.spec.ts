import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TripEditorComponent } from './trip-editor.component';

describe('TripEditorComponent', () => {
  let component: TripEditorComponent;
  let fixture: ComponentFixture<TripEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TripEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

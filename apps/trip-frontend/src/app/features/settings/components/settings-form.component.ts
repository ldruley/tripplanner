import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  standalone: true,
  selector: 'app-settings-form',
  templateUrl: './settings-form.component.html',
  styleUrl: 'settings-form.component.css',
  imports: [ButtonComponent, ReactiveFormsModule],
})
export class SettingsFormComponent {
  @Input() form!: FormGroup;
  @Input() loading = false;
  @Input() error: string | null = null;

  @Output() saveRequested = new EventEmitter<void>();
  @Output() cancelRequested = new EventEmitter<void>();

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  onSave(): void {
    if (this.form.valid) {
      this.saveRequested.emit();
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.form.controls).forEach(key => {
        this.form.get(key)?.markAsTouched();
      });
    }
  }

  onCancel(): void {
    this.cancelRequested.emit();
  }
}

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  standalone: true,
  selector: 'app-settings-form',
  templateUrl: './settings-form.component.html',
  imports: [NgIf, ButtonComponent, ReactiveFormsModule],
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
}

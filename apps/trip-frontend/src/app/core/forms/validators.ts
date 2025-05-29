import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

export const emailValidator = [Validators.required, Validators.email];
export const passwordValidator = [Validators.required, Validators.minLength(8)];

export function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

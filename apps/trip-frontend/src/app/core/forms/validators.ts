import { AbstractControl, ValidationErrors, Validators } from '@angular/forms';

export const emailValidator = [Validators.required, Validators.email];
export const passwordValidator = [Validators.required, Validators.minLength(8)];

export function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

export function matchNewPasswords(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

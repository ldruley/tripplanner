import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { emailValidator, passwordValidator, matchPasswords, matchNewPasswords } from './validators';

export function buildLoginForm(fb: FormBuilder): FormGroup {
  return fb.group({
    email: ['', emailValidator],
    password: ['', Validators.required],
  });
}

export function buildRegisterForm(fb: FormBuilder): FormGroup {
  return fb.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', emailValidator],
      password: ['', passwordValidator],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: matchPasswords },
  );
}

export function buildForgotPasswordForm(fb: FormBuilder): FormGroup {
  return fb.group({
    email: ['', emailValidator],
  });
}

export function buildChangePasswordForm(fb: FormBuilder): FormGroup {
  return fb.group(
    {
      currentPassword: ['', passwordValidator],
      newPassword: ['', passwordValidator],
      confirmPassword: ['', Validators.required],
    },
    { validators: matchNewPasswords },
  );
}

export function buildSettingsForm(fb: FormBuilder): FormGroup {
  return fb.group({
    timezone: ['Europe/London', Validators.required], // GMT/UTC equivalent
    distanceUnit: ['MILES', Validators.required],
    darkMode: [false],
  });
}

// Type-safe helper for dynamic form controls if needed
type FormControlConfig = [string | null, ValidatorFn | ValidatorFn[] | null];

export function buildDynamicForm(
  fb: FormBuilder,
  controls: Record<string, FormControlConfig>,
  formValidators?: ValidatorFn | ValidatorFn[],
): FormGroup {
  return fb.group(controls, { validators: formValidators });
}

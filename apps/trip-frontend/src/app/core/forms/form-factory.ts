import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { emailValidator, passwordValidator, matchPasswords } from './validators';

export function buildLoginForm(fb: FormBuilder): FormGroup {
  return fb.group({
    email: ['', emailValidator],
    password: ['', Validators.required],
  });
}

export function buildRegisterForm(fb: FormBuilder, includeUsername = false): FormGroup {
  const group: Record<string, any> = {
    email: ['', emailValidator],
    password: ['', passwordValidator],
    confirmPassword: ['', Validators.required],
  };

  if (includeUsername) {
    group['username'] = ['', Validators.required];
  }

  return fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    confirmPassword: ['', Validators.required],
  }, { validators: matchPasswords });
}

export function buildForgotPasswordForm(fb: FormBuilder): FormGroup {
  return fb.group({
    email: ['', emailValidator],
  });
}

export function buildResetPasswordForm(fb: FormBuilder): FormGroup {
  return fb.group({
    password: ['', passwordValidator],
    confirmPassword: ['', Validators.required],
  }, { validators: matchPasswords });
}

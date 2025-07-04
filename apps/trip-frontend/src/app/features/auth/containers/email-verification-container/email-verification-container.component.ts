import { Component, OnInit, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../../shared/services';

@Component({
  selector: 'app-email-verification-container',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          @if (isVerifying) {
            <div class="text-center">
              <div
                class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
              ></div>
              <h2 class="text-lg font-medium text-gray-900">Verifying your email...</h2>
              <p class="mt-2 text-sm text-gray-600">
                Please wait while we verify your email address.
              </p>
            </div>
          }
    
          @if (verificationStatus === 'success') {
            <div class="text-center">
              <div
                class="rounded-full h-12 w-12 bg-green-100 mx-auto mb-4 flex items-center justify-center"
                >
                <svg
                  class="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <h2 class="text-lg font-medium text-gray-900">Email Verified Successfully!</h2>
              <p class="mt-2 text-sm text-gray-600">
                Your email has been verified. You can now access all features.
              </p>
              <button
                (click)="navigateToDashboard()"
                class="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                Continue to Dashboard
              </button>
            </div>
          }
    
          @if (verificationStatus === 'error') {
            <div class="text-center">
              <div
                class="rounded-full h-12 w-12 bg-red-100 mx-auto mb-4 flex items-center justify-center"
                >
                <svg
                  class="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </div>
              <h2 class="text-lg font-medium text-gray-900">Verification Failed</h2>
              <p class="mt-2 text-sm text-gray-600">{{ errorMessage }}</p>
              <div class="mt-4 space-y-3">
                <button
                  (click)="navigateToLogin()"
                  class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                  Back to Login
                </button>
                <button
                  (click)="showResendForm = true"
                  class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                  Resend Verification Email
                </button>
              </div>
            </div>
          }
    
          @if (showResendForm) {
            <div class="mt-6">
              <form (ngSubmit)="resendVerification()" class="space-y-4">
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    [(ngModel)]="resendEmail"
                    required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email address"
                    />
                  </div>
                  <button
                    type="submit"
                    [disabled]="isResending"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                    >
                    {{ isResending ? 'Sending...' : 'Send Verification Email' }}
                  </button>
                </form>
              </div>
            }
          </div>
        </div>
      </div>
    `,
})
export class EmailVerificationContainerComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  isVerifying = true;
  verificationStatus: 'success' | 'error' | 'verifying' = 'verifying';
  errorMessage: string | null = null;
  showResendForm = false;
  isResending = false;
  resendEmail = '';

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];

    if (!token) {
      this.verificationStatus = 'error';
      this.errorMessage = 'Invalid verification link. No token provided.';
      this.isVerifying = false;
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: result => {
        this.isVerifying = false;
        if (result.success) {
          this.verificationStatus = 'success';
          this.toastService.showSuccess(
            'Email verified!',
            'Your email has been successfully verified.',
          );
        } else {
          this.verificationStatus = 'error';
          this.errorMessage = result.error || 'Email verification failed';
          this.toastService.showError('Verification failed', this.errorMessage);
        }
      },
      error: error => {
        this.isVerifying = false;
        this.verificationStatus = 'error';
        this.errorMessage = 'An unexpected error occurred during verification';
        this.toastService.showError('Verification error', this.errorMessage);
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  resendVerification(): void {
    if (!this.resendEmail) {
      return;
    }

    this.isResending = true;
    this.authService.resendVerificationEmail(this.resendEmail).subscribe({
      next: result => {
        this.isResending = false;
        if (result.success) {
          this.showResendForm = false;
          this.toastService.showSuccess(
            'Email sent!',
            'Verification email sent successfully. Please check your inbox.',
          );
        } else {
          this.errorMessage = result.error || 'Failed to send verification email';
          this.toastService.showError('Send failed', this.errorMessage);
        }
      },
      error: error => {
        this.isResending = false;
        this.errorMessage = 'An error occurred while sending the verification email';
        this.toastService.showError('Send error', this.errorMessage);
      },
    });
  }
}

import { Component, inject, OnInit } from '@angular/core';

import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { ToastService } from '../../../shared/services';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  //public readonly userDisplayName$: Observable<string | null>;

  constructor() {
    /* this.userDisplayName$ = this.authService.authState$.pipe(
      map(state => {
        if (state.user?.userMetadata?.['display_name']) {
          return state.user.user_metadata['display_name'];
        }
        if (state.user?.user_metadata?.['first_name']) {
          const firstName = state.user.user_metadata['first_name'];
          const lastName = state.user?.user_metadata?.['last_name'] || '';
          return `${firstName} ${lastName}`.trim();
        }
        return state.user?.email || null;
      })
    );*/
  }

  ngOnInit(): void {
    // Check if user is authenticated, redirect to login if not
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
    }
  }

  public async handleSignOut(): Promise<void> {
    await this.authService.signOut();
  }

  public handleNewTrip(): void {
    this.router.navigate(['/trip-planning/new']);
  }

  // Toast testing methods
  public testSuccessToast(): void {
    this.toastService.showSuccess(
      'Success!',
      'This is a success message that shows something went well.',
    );
  }

  public testErrorToast(): void {
    this.toastService.showError(
      'Error!',
      'This is an error message that shows something went wrong.',
    );
  }

  public testWarningToast(): void {
    this.toastService.showWarn(
      'Warning!',
      'This is a warning message to alert you about something.',
    );
  }

  public testInfoToast(): void {
    this.toastService.showInfo(
      'Information',
      'This is an informational message with helpful details.',
    );
  }

  public testLoadingToast(): void {
    const toastId = this.toastService.showLoading(
      'Loading...',
      'Please wait while we process your request.',
    );

    // Simulate async operation
    setTimeout(() => {
      this.toastService.updateToast(toastId, {
        severity: 'success',
        summary: 'Complete!',
        detail: 'Your request has been processed successfully.',
        sticky: false,
        closable: true,
        life: 3000,
      });
    }, 2000);
  }

  public clearAllToasts(): void {
    this.toastService.clearAll();
  }
}

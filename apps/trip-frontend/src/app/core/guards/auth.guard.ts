// src/app/core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, take, filter, tap } from 'rxjs/operators';
import { AuthService } from '../../features/auth/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authState$.pipe(
    // Wait for auth to finish loading
    filter(authState => !authState.loading),
    take(1),
    tap(authState => {
      console.log('Auth Guard - Auth State:', authState);
      console.log('Auth Guard - Protecting route:', state.url);
    }),
    map(authState => {
      if (authState.user) {
        console.log('Auth Guard - User authenticated, allowing access');
        return true;
      } else {
        console.log('Auth Guard - User not authenticated, redirecting to login');
        router.navigate(['/auth/login'], {
          queryParams: { returnUrl: state.url }
        });
        return false;
      }
    })
  );
};

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';
import { AuthService } from '../../features/auth/services/auth.service';
import { environment } from '../../../environments/environment';

const backendApiBaseUrl = environment.backendApiUrl;
let isRefreshing = false;
let refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authToken = authService.getToken();

  if (req.method === 'OPTIONS') {
    return next(req);
  }

  // Skip auth header for login, register, and refresh endpoints
  if (
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh')
  ) {
    // Ensure withCredentials is set for auth endpoints to handle cookies
    const authReq = req.clone({
      setHeaders: req.url.includes('/auth/refresh') ? {} : undefined,
      withCredentials: req.url.includes('/auth/') ? true : req.withCredentials,
    });
    return next(authReq);
  }

  if (authToken && req.url.startsWith(backendApiBaseUrl)) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`,
      },
      withCredentials: true, // Ensure cookies are sent with authenticated requests
    });

    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !req.url.includes('/auth/refresh')) {
          return handle401Error(authReq, next, authService);
        }
        return throwError(() => error);
      }),
    );
  }

  return next(req);
};

function handle401Error(req: any, next: any, authService: AuthService): Observable<any> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshTokens().pipe(
      switchMap(response => {
        isRefreshing = false;
        refreshTokenSubject.next(response.access_token);

        // Retry the original request with the new token
        const newAuthReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${response.access_token}`,
          },
          withCredentials: true,
        });
        return next(newAuthReq);
      }),
      catchError(error => {
        isRefreshing = false;
        authService.signOut();
        return throwError(() => error);
      }),
    );
  } else {
    // If refresh is in progress, wait for it to complete
    return refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => {
        const newAuthReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        });
        return next(newAuthReq);
      }),
    );
  }
}

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (req.method === 'OPTIONS') {
      return next(req);
    }

  if (req.url.startsWith('http://localhost:3000/api/')) {
    const session = authService.getCurrentSession();
    console.log(session);
    if (session?.access_token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
    }
  }

  return next(req);
};

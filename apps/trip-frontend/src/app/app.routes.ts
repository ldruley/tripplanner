import { Route, Routes } from '@angular/router';

export const appRoutes: Route[] =
  [
    {
      path: '',
      redirectTo: 'login',
      pathMatch: 'full'
    },
    {
      path: 'login',
      loadComponent: () =>
        import('./features/auth/containers/login-container/login-container.component').then(m => m.LoginContainerComponent),
      title: 'Sign In'
    }
  ];

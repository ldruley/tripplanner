// src/app/app.routes.ts
import { Route } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/containers/auth-container/auth-container.component').then(m => m.AuthContainerComponent),
        title: 'Sign In - Trip Planner'
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/containers/auth-container/auth-container.component').then(m => m.AuthContainerComponent),
        title: 'Sign Up - Trip Planner'
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./features/auth/containers/auth-container/auth-container.component').then(m => m.AuthContainerComponent),
        title: 'Change Password - Trip Planner',
        canActivate: [authGuard]
      },
      {
        path: 'forgot',
        loadComponent: () =>
          import('./features/auth/containers/auth-container/auth-container.component').then(m => m.AuthContainerComponent),
        title: 'Recover Password - Trip Planner',
        canActivate: [authGuard]
      },
      {
        path: 'signup',
        redirectTo: 'register'
      }
    ]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Dashboard - Trip Planner',
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/containers/profile-container/profile-container.component').then(m => m.ProfileContainerComponent),
    title: 'Profile Settings - Trip Planner',
    canActivate: [authGuard]
  }
];

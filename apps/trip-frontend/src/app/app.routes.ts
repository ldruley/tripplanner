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
    loadChildren: () =>
      import('./features/auth/auth.routes').then(
        (m) => m.AUTH_ROUTES)
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
  },
  {
    path: 'trip-planning',
    loadChildren: () =>
      import('./features/trip-planning/trip-planning.routes').then(
        (m) => m.TRIP_PLANNING_ROUTES
      ),
    canActivate: [authGuard],
  },
];

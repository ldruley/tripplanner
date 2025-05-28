import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/containers/login-container/login-container.component').then(m => m.LoginContainerComponent),
        title: 'Sign In - Trip Planner'
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/containers/register-container/register-container.component').then(m => m.RegisterContainerComponent),
        title: 'Sign Up - Trip Planner'
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
    title: 'Dashboard - Trip Planner'
    //TODO: Add auth guard here when implemented
  },
  {
      path: 'profile',
      loadComponent: () =>
        import('./features/profile/containers/profile-container/profile-container.component').then(m => m.ProfileContainerComponent),
      title: 'Profile Settings - Trip Planner'
      //TODO: Add auth guard here when implemented
    }
];

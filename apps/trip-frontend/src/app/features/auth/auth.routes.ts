import { Routes } from '@angular/router';
import { AuthContainerComponent } from './containers/auth-container/auth-container.component';
import { authGuard } from '../../core/guards/auth.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    component: AuthContainerComponent
  },
  {
    path: 'register',
    component: AuthContainerComponent
  },
  {
    path: 'change-password',
    component: AuthContainerComponent,
    canActivate: [authGuard],
  },
  {
    path: 'forgot',
    component: AuthContainerComponent
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
];

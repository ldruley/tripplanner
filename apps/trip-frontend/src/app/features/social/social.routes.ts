import { Route } from '@angular/router';

export const SOCIAL_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./containers/social-container/social-container.component').then(
        m => m.SocialContainerComponent,
      ),
    title: 'Social - Trip Planner',
  },
];
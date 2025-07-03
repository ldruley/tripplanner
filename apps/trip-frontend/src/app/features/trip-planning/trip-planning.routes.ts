import { Routes } from '@angular/router';
import { TripContainerComponent } from './containers/trip-container/trip-container.component';

export const TRIP_PLANNING_ROUTES: Routes = [
  {
    path: 'new',
    component: TripContainerComponent,
  },
  {
    path: ':tripId',
    component: TripContainerComponent,
  },
  {
    path: '', // Default, maybe redirect to a list or dashboard later
    redirectTo: 'new',
    pathMatch: 'full',
  },
];

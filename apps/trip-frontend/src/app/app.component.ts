import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './features/shared/components';
import { ToastContainerComponent } from './features/shared/components';

@Component({
  imports: [HeaderComponent, RouterModule, ToastContainerComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';
}

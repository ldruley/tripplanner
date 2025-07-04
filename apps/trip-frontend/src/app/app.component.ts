import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './features/shared/components';
import { Toast } from 'primeng/toast';

@Component({
  imports: [HeaderComponent, RouterModule, Toast],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';
}

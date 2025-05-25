import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './features/shared/components/header/header.component';

@Component({
  imports: [HeaderComponent, RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';
}

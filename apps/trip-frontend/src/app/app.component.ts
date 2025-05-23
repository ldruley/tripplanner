import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcomeComponent } from './nx-welcome.component';
import { HeaderComponent } from './features/shared/components/header/header.component';
import { RegisterFormComponent } from './features/auth/components/register-form/register-form.component';

@Component({
  imports: [HeaderComponent, RouterModule, RegisterFormComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';
}

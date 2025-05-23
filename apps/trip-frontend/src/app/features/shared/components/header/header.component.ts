import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-header',
  imports: [CommonModule, ButtonComponent],
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  onLogin() {
    // TODO: Implement login functionality
    console.log('Login clicked');
  }

  onRegister() {
    // TODO: Implement register functionality
    console.log('Register clicked');
  }
}

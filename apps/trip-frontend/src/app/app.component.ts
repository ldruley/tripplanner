import { Component, ViewChild, computed, signal, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { HeaderComponent, SidebarComponent } from './features/shared/components';
import { Toast } from 'primeng/toast';
import { AuthService } from './features/auth/services/auth.service';
import { map } from 'rxjs/operators';

@Component({
  imports: [HeaderComponent, SidebarComponent, RouterModule, Toast, AsyncPipe],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';

  private readonly authService = inject(AuthService);

  @ViewChild('sidebarRef') sidebar!: SidebarComponent;

  // Track sidebar state for layout adjustments
  private readonly _sidebarExpanded = signal(true);
  readonly sidebarExpanded = this._sidebarExpanded.asReadonly();

  // Authentication state
  readonly isAuthenticated$ = this.authService.authState$.pipe(
    map(state => !!state.user && !state.loading)
  );

  readonly mainContainerClasses = computed(() => {
    const classes = ['main-container'];
    if (this.sidebarExpanded()) {
      classes.push('with-sidebar');
    } else {
      classes.push('with-collapsed-sidebar');
    }
    return classes.join(' ');
  });

  onToggleMobileSidebar(): void {
    this.sidebar?.toggleMobileSidebar();
  }

  onSidebarExpandedChange(expanded: boolean): void {
    this._sidebarExpanded.set(expanded);
  }
}

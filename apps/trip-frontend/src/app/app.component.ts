import { Component, ViewChild, computed, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent, SidebarComponent } from './features/shared/components';
import { Toast } from 'primeng/toast';

@Component({
  imports: [HeaderComponent, SidebarComponent, RouterModule, Toast],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'trip-frontend';

  @ViewChild('sidebarRef') sidebar!: SidebarComponent;

  // Track sidebar state for layout adjustments
  private readonly _sidebarExpanded = signal(true);
  readonly sidebarExpanded = this._sidebarExpanded.asReadonly();

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

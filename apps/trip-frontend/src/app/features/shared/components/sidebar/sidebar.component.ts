import { Component, computed, inject, signal, Output, EventEmitter, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../button/button.component';
import { LocalStorageService } from '../../../../core/services/local-storage.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly localStorageService = inject(LocalStorageService);
  
  private static readonly SIDEBAR_EXPANDED_KEY = 'sidebar-expanded';

  // Output events
  @Output() expandedChange = new EventEmitter<boolean>();

  // State management with signals
  private readonly _isExpanded = signal(true);
  private readonly _isMobileOpen = signal(false);
  private readonly _isMobileClosing = signal(false);

  // Public readonly signals
  readonly isExpanded = this._isExpanded.asReadonly();
  readonly isMobileOpen = this._isMobileOpen.asReadonly();
  readonly isMobileClosing = this._isMobileClosing.asReadonly();

  // Computed properties for UI state
  readonly showLabels = computed(() => this.isExpanded() || this.isMobileOpen());
  readonly shouldShowMobileSidebar = computed(() => this.isMobileOpen() || this.isMobileClosing());

  ngOnInit(): void {
    // Load saved sidebar state from localStorage
    const savedState = this.localStorageService.get<boolean>(SidebarComponent.SIDEBAR_EXPANDED_KEY);
    if (savedState !== null) {
      this._isExpanded.set(savedState);
      this.expandedChange.emit(savedState);
    }
  }

  // Navigation methods
  onNewTrip(): void {
    this.router.navigate(['/trip-planning/new']);
    this.closeMobileSidebar();
  }

  onMyTrips(): void {
    this.router.navigate(['/trips']);
    this.closeMobileSidebar();
  }

  onMyLocations(): void {
    this.router.navigate(['/locations']);
    this.closeMobileSidebar();
  }

  onDashboard(): void {
    this.router.navigate(['/dashboard']);
    this.closeMobileSidebar();
  }

  // Sidebar state management
  toggleExpanded(): void {
    const newState = !this.isExpanded();
    this._isExpanded.set(newState);
    this.expandedChange.emit(newState);
    // Persist the sidebar state
    this.localStorageService.set(SidebarComponent.SIDEBAR_EXPANDED_KEY, newState);
  }

  toggleMobileSidebar(): void {
    this._isMobileOpen.set(!this.isMobileOpen());
  }

  closeMobileSidebar(): void {
    if (!this.isMobileOpen()) return;
    
    // Start the closing animation
    this._isMobileClosing.set(true);
    
    // Wait for animation to complete, then hide the sidebar
    setTimeout(() => {
      this._isMobileOpen.set(false);
      this._isMobileClosing.set(false);
    }, 250); // Match the exit animation duration
  }

  openMobileSidebar(): void {
    this._isMobileOpen.set(true);
  }

  // Keyboard accessibility
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Close mobile sidebar with Escape key
    if (event.key === 'Escape' && this.isMobileOpen()) {
      this.closeMobileSidebar();
      event.preventDefault();
    }
  }
}
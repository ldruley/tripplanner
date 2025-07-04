import { Injectable, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { 
  Toast, 
  ToastMessage, 
  ToastSeverity, 
  ToastConfig
} from '@trip-planner/types';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  private config: ToastConfig = {
    position: 'top-right',
    autoZIndex: true,
    baseZIndex: 0,
    life: 3000,
    sticky: false,
    closable: true
  };


  /**
   * Get readonly signal of current toasts
   */
  readonly toasts = this._toasts.asReadonly();

  /**
   * Get readonly signal count of current toasts
   */
  readonly count = computed(() => this._toasts().length);

  /**
   * Get observable of current toasts (for backward compatibility)
   * @deprecated Use toasts signal instead
   */
  getToasts(): Observable<Toast[]> {
    return toObservable(this._toasts);
  }

  /**
   * Configure global toast settings
   */
  setConfig(config: Partial<ToastConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ToastConfig {
    return { ...this.config };
  }

  /**
   * Display a toast message
   */
  show(message: ToastMessage): void {
    const toast: Toast = {
      id: this.generateId(),
      severity: message.severity || 'info',
      summary: message.summary,
      detail: message.detail,
      life: message.life || this.config.life,
      sticky: message.sticky !== undefined ? message.sticky : this.config.sticky,
      closable: message.closable !== undefined ? message.closable : this.config.closable,
      data: message.data,
      key: message.key
    };

    const currentToasts = this._toasts();
    this._toasts.set([...currentToasts, toast]);

    // Auto-dismiss if not sticky
    if (!toast.sticky && toast.life && toast.life > 0) {
      setTimeout(() => {
        this.remove(toast.id);
      }, toast.life);
    }
  }

  /**
   * Show success toast
   */
  showSuccess(summary: string, detail?: string, life?: number): void {
    this.show({
      severity: 'success',
      summary,
      detail,
      life
    });
  }

  /**
   * Show info toast
   */
  showInfo(summary: string, detail?: string, life?: number): void {
    this.show({
      severity: 'info',
      summary,
      detail,
      life
    });
  }

  /**
   * Show warning toast
   */
  showWarn(summary: string, detail?: string, life?: number): void {
    this.show({
      severity: 'warn',
      summary,
      detail,
      life
    });
  }

  /**
   * Show error toast
   */
  showError(summary: string, detail?: string, life?: number): void {
    this.show({
      severity: 'error',
      summary,
      detail,
      life,
      sticky: true // Errors should be sticky by default
    });
  }

  /**
   * Remove a specific toast by ID
   */
  remove(toastId: string): void {
    const currentToasts = this._toasts();
    const filteredToasts = currentToasts.filter(toast => toast.id !== toastId);
    this._toasts.set(filteredToasts);
  }

  /**
   * Clear toasts by key (group)
   */
  clear(key?: string): void {
    if (!key) {
      this.clearAll();
      return;
    }

    const currentToasts = this._toasts();
    const filteredToasts = currentToasts.filter(toast => toast.key !== key);
    this._toasts.set(filteredToasts);
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this._toasts.set([]);
  }

  /**
   * Replace all toasts with new ones
   */
  replaceAll(toasts: Toast[]): void {
    this._toasts.set([...toasts]);
  }

  /**
   * Get current toast count
   * @deprecated Use count signal instead
   */
  getCount(): number {
    return this._toasts().length;
  }

  /**
   * Check if there are any toasts of a specific severity
   */
  hasSeverity(severity: ToastSeverity): boolean {
    return this._toasts().some(toast => toast.severity === severity);
  }

  /**
   * Get toasts by key (group)
   */
  getByKey(key: string): Toast[] {
    return this._toasts().filter(toast => toast.key === key);
  }

  /**
   * Generate unique ID for toast
   */
  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Convenience methods for common use cases

  /**
   * Show a simple success message
   */
  success(message: string): void {
    this.showSuccess('Success', message);
  }

  /**
   * Show a simple error message
   */
  error(message: string): void {
    this.showError('Error', message);
  }

  /**
   * Show a simple warning message
   */
  warn(message: string): void {
    this.showWarn('Warning', message);
  }

  /**
   * Show a simple info message
   */
  info(message: string): void {
    this.showInfo('Info', message);
  }

  /**
   * Show a loading toast that can be updated
   */
  showLoading(summary: string, detail?: string): string {
    const toast: ToastMessage = {
      severity: 'info',
      summary,
      detail,
      sticky: true,
      closable: false
    };
    
    this.show(toast);
    
    // Return the generated ID so caller can update or remove this specific toast
    const currentToasts = this._toasts();
    return currentToasts[currentToasts.length - 1].id;
  }

  /**
   * Update a specific toast (useful for loading states)
   */
  updateToast(toastId: string, updates: Partial<ToastMessage>): void {
    const currentToasts = this._toasts();
    const toastIndex = currentToasts.findIndex(toast => toast.id === toastId);
    
    if (toastIndex !== -1) {
      const updatedToast = { 
        ...currentToasts[toastIndex], 
        ...updates,
        id: toastId // Preserve the ID
      };
      
      const updatedToasts = [...currentToasts];
      updatedToasts[toastIndex] = updatedToast;
      this._toasts.set(updatedToasts);
      
      // Handle auto-dismiss for updated toast
      if (!updatedToast.sticky && updatedToast.life && updatedToast.life > 0) {
        setTimeout(() => {
          this.remove(toastId);
        }, updatedToast.life);
      }
    }
  }
}
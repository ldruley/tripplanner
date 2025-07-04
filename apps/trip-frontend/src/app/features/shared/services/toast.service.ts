import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { 
  ToastMessage, 
  ToastSeverity 
} from '@trip-planner/types';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly messageService = inject(MessageService);
  private defaultLife = 3000;

  /**
   * Display a toast message
   */
  show(message: ToastMessage): void {
    console.log('ToastService.show() called with:', message);
    this.messageService.add({
      severity: message.severity || 'info',
      summary: message.summary,
      detail: message.detail,
      life: message.life || this.defaultLife,
      sticky: message.sticky,
      closable: message.closable,
      data: message.data,
      key: message.key
    });
    console.log('Message added to PrimeNG MessageService');
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
    this.messageService.clear(toastId);
  }

  /**
   * Clear toasts by key (group)
   */
  clear(key?: string): void {
    this.messageService.clear(key);
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.messageService.clear();
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
   * Show a loading toast
   */
  showLoading(summary: string, detail?: string, key?: string): void {
    this.show({
      severity: 'info',
      summary,
      detail,
      sticky: true,
      closable: false,
      key
    });
  }
}
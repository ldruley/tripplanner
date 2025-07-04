import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast } from '@trip-planner/types';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-item"
      [ngClass]="getToastClasses()"
      role="alert"
      aria-live="polite"
      >
      <div class="toast-icon">
        @if (toast.severity === 'success') {
          <svg
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        }
    
        @if (toast.severity === 'error') {
          <svg
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        }
    
        @if (toast.severity === 'warn') {
          <svg
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        }
    
        @if (toast.severity === 'info') {
          <svg
            class="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
            >
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        }
      </div>
    
      <div class="toast-content">
        <div class="toast-summary" [class.toast-summary-only]="!toast.detail">
          {{ toast.summary }}
        </div>
        @if (toast.detail) {
          <div class="toast-detail">
            {{ toast.detail }}
          </div>
        }
      </div>
    
      @if (toast.closable) {
        <button
          type="button"
          class="toast-close"
          (click)="onClose()"
          aria-label="Close notification"
          >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      }
    </div>
    `,
  styles: [`
    .toast-item {
      @apply flex items-start p-4 mb-3 rounded-lg shadow-lg border-l-4;
      @apply transform transition-all duration-300 ease-in-out;
      @apply bg-white dark:bg-gray-800;
      min-width: 300px;
      max-width: 500px;
    }

    .toast-item.toast-success {
      @apply border-green-500 bg-green-50 dark:bg-green-900/20;
    }

    .toast-item.toast-error {
      @apply border-red-500 bg-red-50 dark:bg-red-900/20;
    }

    .toast-item.toast-warn {
      @apply border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20;
    }

    .toast-item.toast-info {
      @apply border-blue-500 bg-blue-50 dark:bg-blue-900/20;
    }

    .toast-icon {
      @apply flex-shrink-0 mr-3 mt-0.5;
    }

    .toast-success .toast-icon {
      @apply text-green-600 dark:text-green-400;
    }

    .toast-error .toast-icon {
      @apply text-red-600 dark:text-red-400;
    }

    .toast-warn .toast-icon {
      @apply text-yellow-600 dark:text-yellow-400;
    }

    .toast-info .toast-icon {
      @apply text-blue-600 dark:text-blue-400;
    }

    .toast-content {
      @apply flex-1 min-w-0;
    }

    .toast-summary {
      @apply font-medium text-gray-900 dark:text-gray-100;
      @apply text-sm leading-tight;
    }

    .toast-summary-only {
      @apply text-base;
    }

    .toast-detail {
      @apply mt-1 text-sm text-gray-600 dark:text-gray-300;
    }

    .toast-close {
      @apply flex-shrink-0 ml-3 p-1 rounded-md;
      @apply text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300;
      @apply transition-colors duration-200;
      @apply focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500;
    }

    .toast-close:hover {
      @apply bg-gray-100 dark:bg-gray-700;
    }

    /* Animation classes */
    .toast-item {
      animation: slideInRight 0.3s ease-out;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-item.toast-leaving {
      animation: slideOutRight 0.3s ease-in forwards;
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `]
})
export class ToastComponent {
  @Input() toast!: Toast;
  @Output() closeToast = new EventEmitter<string>();

  getToastClasses(): string {
    return `toast-${this.toast.severity}`;
  }

  onClose(): void {
    this.closeToast.emit(this.toast.id);
  }
}
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Toast, ToastConfig } from '@trip-planner/types';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../toast/toast.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, ToastComponent],
  template: `
    <div
      class="toast-container"
      [ngClass]="getContainerClasses()"
      [style.z-index]="getZIndex()"
      >
      @for (toast of toasts(); track trackByToastId($index, toast)) {
        <app-toast
          [toast]="toast"
          (closeToast)="onCloseToast($event)"
        ></app-toast>
      }
    </div>
    `,
  styles: [`
    .toast-container {
      @apply fixed pointer-events-none;
      @apply flex flex-col;
    }

    .toast-container > * {
      @apply pointer-events-auto;
    }

    /* Position classes */
    .toast-top-left {
      @apply top-4 left-4;
    }

    .toast-top-center {
      @apply top-4 left-1/2 transform -translate-x-1/2;
    }

    .toast-top-right {
      @apply top-4 right-4;
    }

    .toast-bottom-left {
      @apply bottom-4 left-4;
      @apply flex-col-reverse;
    }

    .toast-bottom-center {
      @apply bottom-4 left-1/2 transform -translate-x-1/2;
      @apply flex-col-reverse;
    }

    .toast-bottom-right {
      @apply bottom-4 right-4;
      @apply flex-col-reverse;
    }

    .toast-center {
      @apply top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2;
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      .toast-container {
        @apply left-2 right-2;
      }

      .toast-top-left,
      .toast-top-right {
        @apply left-2 right-2;
      }

      .toast-bottom-left,
      .toast-bottom-right {
        @apply left-2 right-2;
      }

      .toast-top-center {
        @apply left-2 right-2 transform-none;
      }

      .toast-bottom-center {
        @apply left-2 right-2 transform-none;
      }

      .toast-center {
        @apply left-2 right-2 transform -translate-y-1/2;
      }
    }
  `]
})
export class ToastContainerComponent implements OnInit {
  private readonly toastService = inject(ToastService);
  
  readonly toasts = this.toastService.toasts;
  config!: ToastConfig;

  ngOnInit(): void {
    this.config = this.toastService.getConfig();
  }

  getContainerClasses(): string {
    return `toast-${this.config.position}`;
  }

  getZIndex(): number {
    if (this.config.autoZIndex) {
      return 1000 + (this.config.baseZIndex || 0);
    }
    return this.config.baseZIndex || 0;
  }

  onCloseToast(toastId: string): void {
    this.toastService.remove(toastId);
  }

  trackByToastId(index: number, toast: Toast): string {
    return toast.id;
  }
}
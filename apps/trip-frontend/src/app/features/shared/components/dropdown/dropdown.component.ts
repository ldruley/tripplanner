import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  OnDestroy,
} from '@angular/core';


export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

@Component({
  selector: 'app-dropdown',
  imports: [],
  standalone: true,
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.css',
})
export class DropdownComponent implements OnDestroy {
  @Input() items: DropdownItem[] = [];
  @Input() isOpen = false;
  @Input() triggerElement: HTMLElement | null = null;
  @Output() closeDropdown = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Don't close if clicking within the dropdown
    if (this.elementRef.nativeElement.contains(target)) {
      return;
    }

    // Don't close if clicking on the trigger element
    if (this.triggerElement && this.triggerElement.contains(target)) {
      return;
    }

    // Close the dropdown for any other click
    if (this.isOpen) {
      this.closeDropdown.emit();
    }
  }

  @HostListener('keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen) {
      this.closeDropdown.emit();
    }
  }

  onItemClick(item: DropdownItem): void {
    if (!item.disabled) {
      item.action();
      this.closeDropdown.emit();
    }
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions if needed
  }
}

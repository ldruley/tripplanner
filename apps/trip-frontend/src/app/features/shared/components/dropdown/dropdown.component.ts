import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button.component';


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
  imports: [ButtonComponent, FormsModule],
  standalone: true,
  templateUrl: './dropdown.component.html',
  styleUrl: './dropdown.component.css',
})
export class DropdownComponent implements OnDestroy, OnChanges {
  @Input() items: DropdownItem[] = [];
  @Input() isOpen = false;
  @Input() triggerElement: HTMLElement | null = null;
  @Input() showFilter = false;
  @Input() filterPlaceholder = 'Filter items...';
  @Input() itemAlignment: 'left' | 'center' | 'right' = 'left';
  @Input() itemJustification: 'start' | 'center' | 'between' | 'around' = 'start';
  @Output() closeDropdown = new EventEmitter<void>();

  filterText = signal('');
  
  filteredItems = computed(() => {
    const filter = this.filterText().toLowerCase().trim();
    if (!filter || !this.showFilter) {
      return this.items;
    }
    return this.items.filter(item => 
      !item.divider && item.label.toLowerCase().includes(filter)
    );
  });

  // Computed CSS classes for item alignment
  itemAlignmentClass = computed(() => {
    const alignmentMap = {
      'left': 'text-left',
      'center': 'text-center', 
      'right': 'text-right'
    };
    return alignmentMap[this.itemAlignment];
  });

  itemJustificationClass = computed(() => {
    const justificationMap = {
      'start': 'justify-start',
      'center': 'justify-center',
      'between': 'justify-between',
      'around': 'justify-around'
    };
    return justificationMap[this.itemJustification];
  });

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

  onFilterChange(value: string): void {
    this.filterText.set(value);
  }

  clearFilter(): void {
    this.filterText.set('');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && !changes['isOpen'].currentValue) {
      this.clearFilter();
    }
  }

  ngOnDestroy(): void {
    // Clean up any subscriptions if needed
  }
}

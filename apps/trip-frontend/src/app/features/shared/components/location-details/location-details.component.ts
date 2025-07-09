import {
  Component,
  input,
  output,
  computed,
  signal,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location, UserFavoriteLocationWithLocation, UpdateUserFavoriteLocation } from '@trip-planner/types';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-location-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: './location-details.component.html',
  styleUrls: ['./location-details.component.css']
})
export class LocationDetailsComponent implements OnInit {
  location = input.required<Location>();
  favoriteData = input<UserFavoriteLocationWithLocation | null>(null);
  isEditable = input<boolean>(false);
  isModal = input<boolean>(false);
  isOpen = input<boolean>(false);

  closeModal = output<void>();
  favoriteToggled = output<{ locationId: string; isFavorite: boolean }>();
  metadataUpdated = output<{ locationId: string; metadata: UpdateUserFavoriteLocation }>();

  // Form state
  editForm!: FormGroup;
  isEditMode = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  tagInput = signal<string>('');

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    const favorite = this.favoriteData();
    this.editForm = this.fb.group({
      alias: [favorite?.alias || '', [Validators.maxLength(100)]],
      notes: [favorite?.notes || '', [Validators.maxLength(500)]],
      tags: [favorite?.tags || []]
    });
  }

  // Computed properties for display
  fullAddress = computed(() => {
    const loc = this.location();
    const addressParts = [
      loc.address,
      loc.city,
      loc.state,
      loc.country,
      loc.postalCode
    ].filter(Boolean);

    return addressParts.length > 0 ? addressParts.join(', ') : null;
  });

  displayName = computed(() => {
    const favorite = this.favoriteData();
    return favorite?.alias || this.location().name;
  });

  displayTags = computed(() => {
    const favorite = this.favoriteData();
    return favorite?.tags || [];
  });

  displayNotes = computed(() => {
    const favorite = this.favoriteData();
    return favorite?.notes;
  });

  isFavorite = computed(() => {
    return !!this.favoriteData();
  });

  geocodingProviderDisplay = computed(() => {
    const provider = this.location().apiSource;
    if (!provider) return null;

    const providerMap: Record<string, string> = {
      'HERE': 'HERE',
      'MAPBOX': 'Mapbox',
      'GOOGLE_PLACES': 'Google Places',
      'USER_INPUT': 'User Input',
      'INTERNAL_SEED': 'Internal'
    };

    return providerMap[provider] || provider;
  });

  categoryDisplay = computed(() => {
    const category = this.location().category;
    if (!category) return null;

    return category.replace(/_/g, ' ').toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Actions
  onClose() {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onFavoriteToggle() {
    this.favoriteToggled.emit({
      locationId: this.location().id,
      isFavorite: !this.isFavorite()
    });
  }

  onEditMode() {
    this.isEditMode.set(true);
    this.initializeForm(); // Reset form with current data
  }

  onCancelEdit() {
    this.isEditMode.set(false);
    this.initializeForm(); // Reset form to original data
  }

  onSaveEdit() {
    if (this.editForm.valid) {
      this.isLoading.set(true);

      const formValue = this.editForm.value;
      const metadata: UpdateUserFavoriteLocation = {
        alias: formValue.alias?.trim() || null,
        notes: formValue.notes?.trim() || null,
        tags: formValue.tags || []
      };

      this.metadataUpdated.emit({
        locationId: this.location().id,
        metadata
      });

      this.isEditMode.set(false);
      this.isLoading.set(false);
    }
  }

  // Tag management
  onAddTag() {
    const tagValue = this.tagInput().trim();
    if (tagValue) {
      const currentTags = this.editForm.get('tags')?.value || [];
      if (!currentTags.includes(tagValue)) {
        const newTags = [...currentTags, tagValue];
        this.editForm.patchValue({ tags: newTags });
      }
      this.tagInput.set('');
    }
  }

  onRemoveTag(tag: string) {
    const currentTags = this.editForm.get('tags')?.value || [];
    const newTags = currentTags.filter((t: string) => t !== tag);
    this.editForm.patchValue({ tags: newTags });
  }

  onTagInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onAddTag();
    }
  }

  onTagInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tagInput.set(input.value);
  }

  // Utility methods
  get canEdit(): boolean {
    return this.isEditable() && this.isFavorite();
  }

  get formTags(): string[] {
    return this.editForm.get('tags')?.value || [];
  }
}

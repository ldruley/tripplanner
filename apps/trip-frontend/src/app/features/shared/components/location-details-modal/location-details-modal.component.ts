import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@trip-planner/types';

@Component({
  selector: 'app-location-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './location-details-modal.component.html',
  styleUrls: ['./location-details-modal.component.css']
})
export class LocationDetailsModalComponent {
  location = input.required<Location>();
  isOpen = input<boolean>(false);
  isReadOnly = input<boolean>(true);
  closeModal = output<void>();
  
  // Computed properties for display
  fullAddress = computed(() => {
    const loc = this.location();
    // Handle both shared schema (fullAddress) and database schema (address) field names
    if ('fullAddress' in loc && loc.fullAddress) {
      return loc.fullAddress;
    }
    if ('address' in loc && (loc as any).address) {
      return (loc as any).address;
    }
    
    // Build address from components
    const addressParts = [
      loc.city,
      loc.state,
      loc.country,
      loc.postalCode
    ].filter(Boolean);
    
    return addressParts.length > 0 ? addressParts.join(', ') : null;
  });

  geocodingProviderDisplay = computed(() => {
    const loc = this.location();
    // Handle both shared schema (geocodingProvider) and database schema (apiSource) field names
    const provider = ('geocodingProvider' in loc && loc.geocodingProvider) || 
                    ('apiSource' in loc && (loc as any).apiSource) || null;
    
    if (!provider) return null;
    
    const providerMap: Record<string, string> = {
      'google': 'Google',
      'mapbox': 'Mapbox',
      'here': 'HERE',
      'manual': 'Manual',
      'GOOGLE_PLACES': 'Google Places',
      'FOURSQUARE': 'Foursquare',
      'OPENSTREETMAP': 'OpenStreetMap',
      'HERE': 'HERE',
      'MAPBOX': 'Mapbox',
      'USER_INPUT': 'User Input',
      'INTERNAL_SEED': 'Internal'
    };
    
    return providerMap[provider as string] || provider;
  });

  categoryDisplay = computed(() => {
    const loc = this.location();
    const category = ('category' in loc && (loc as any).category) || null;
    if (!category) return null;
    
    return category.replace(/_/g, ' ').toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  onClose() {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
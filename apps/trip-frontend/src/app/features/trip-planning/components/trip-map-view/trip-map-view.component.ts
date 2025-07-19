import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map, NavigationControl, Marker, LngLatLike, Popup, LngLatBounds } from 'mapbox-gl';
import * as mapboxgl from 'mapbox-gl';
import { TripDataService } from '../../services/trip-data.service';
import { environment } from '../../../../../environments/environment';
import { Trip } from '@trip-planner/types';
import { PolylineStatus } from '../../services/polyline-generation.service';

@Component({
  selector: 'app-trip-map-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container animate-fade-in-fast">
      <div #mapContainer class="map animate-scale-in"></div>
    </div>
  `,
  styleUrls: ['./trip-map-view.component.css']
})
export class TripMapViewComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private readonly tripDataService = inject(TripDataService);
  private map!: Map;
  private markers: Marker[] = [];
  private mapStyleLoaded = false;
  private pendingTrip: Trip | null = null;

  // Polyline generation state
  polylineStatus = signal<PolylineStatus | null>(null);

  constructor() {
    // Use effect to watch for trip changes
    effect(() => {
      const trip = this.tripDataService.currentTrip();
      if (trip) {
        if (this.mapStyleLoaded) {
          this.updateMapWithTripData(trip);
        } else {
          // Store trip data to apply once map is loaded
          this.pendingTrip = trip;
        }
        // Check polyline status when trip changes
        this.checkPolylineStatus();
      }
    });
  }

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-74.006, 40.7128], // Default to NYC
      zoom: 10,
      accessToken: environment.mapboxAccessToken
    });

    this.map.addControl(new NavigationControl());

    // Wait for style to load before accessing map layers
    this.map.on('styledata', () => {
      this.mapStyleLoaded = true;
      // Apply pending trip data if available
      if (this.pendingTrip) {
        this.updateMapWithTripData(this.pendingTrip);
        this.pendingTrip = null;
      }
    });
  }

  private updateMapWithTripData(trip: Trip): void {
    console.log('TripMapView: Updating map with trip data:', trip);
    this.clearMarkers();

    if (!trip.stops || trip.stops.length === 0) {
      console.log('TripMapView: No stops found in trip');
      return;
    }

    // Add markers for stops
    const coordinates: LngLatLike[] = [];

    trip.stops.forEach((stop, index: number) => {
      if (stop.location?.latitude && stop.location?.longitude) {
        const coord: LngLatLike = [stop.location.longitude, stop.location.latitude];
        coordinates.push(coord);

        const marker = new Marker()
          .setLngLat(coord)
          .setPopup(new Popup().setHTML(`
            <h3>${stop.location?.name || 'Stop ' + (index + 1)}</h3>
            <p>${stop.location?.address || ''}</p>
          `))
          .addTo(this.map);

        this.markers.push(marker);
      }
    });

    // Fit map to show all markers
    if (coordinates.length > 0) {
      if (coordinates.length === 1) {
        this.map.setCenter(coordinates[0]);
        this.map.setZoom(14);
      } else {
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new LngLatBounds(coordinates[0], coordinates[0]));

        this.map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 15
        });
      }
    }

    // Add polylines from travel segments or basic lines
    this.addPolylines(trip);

    // If no polylines, add basic straight lines between consecutive stops
    if (!trip.travelSegments || trip.travelSegments.length === 0 ||
        !trip.travelSegments.some(s => s.polyline)) {
      this.addBasicLines(coordinates);
    }
  }

  private addPolylines(trip: Trip): void {
    console.log('TripMapView: Adding polylines, travel segments:', trip.travelSegments);

    if (!trip.travelSegments || trip.travelSegments.length === 0) {
      console.log('TripMapView: No travel segments found');
      return;
    }

    trip.travelSegments.forEach((segment, index: number) => {
      console.log(`TripMapView: Processing segment ${index}:`, segment);
      if (segment.polyline) {
        console.log(`TripMapView: Found polyline for segment ${index}:`, segment.polyline.substring(0, 50) + '...');
        try {
          const coordinates = this.decodePolyline(segment.polyline);
          console.log(`TripMapView: Decoded ${coordinates.length} coordinates for segment ${index}`);

          // Only add source and layer if style is loaded and they don't already exist
          if (this.mapStyleLoaded) {
            const sourceId = `route-${index}`;
            const layerId = `route-${index}`;

            if (!this.map.getSource(sourceId)) {
              console.log(`TripMapView: Adding source ${sourceId}`);
              this.map.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                  }
                }
              });
            }

            if (!this.map.getLayer(layerId)) {
              console.log(`TripMapView: Adding layer ${layerId}`);
              this.map.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round'
                },
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 4
                }
              });
            }
          } else {
            console.log('TripMapView: Map style not loaded yet, skipping polyline');
          }
        } catch (error) {
          console.warn('Failed to decode polyline for segment:', segment, error);
        }
      } else {
        console.log(`TripMapView: No polyline found for segment ${index}`);
      }
    });
  }

  private decodePolyline(polyline: string): number[][] {
    if (!polyline || polyline.length === 0) {
      console.warn('TripMapView: Empty polyline provided');
      return [];
    }

    try {
      const coordinates: number[][] = [];
      let index = 0;
      let lat = 0;
      let lng = 0;

      while (index < polyline.length) {
        // Decode latitude
        let shift = 0;
        let result = 0;
        let byte: number;

        do {
          if (index >= polyline.length) break;
          byte = polyline.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);

        const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        // Decode longitude
        shift = 0;
        result = 0;

        do {
          if (index >= polyline.length) break;
          byte = polyline.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);

        const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        lng += deltaLng;

        // Convert to decimal degrees and add to coordinates
        // Note: Mapbox expects [longitude, latitude] format
        coordinates.push([lng / 1e5, lat / 1e5]);
      }

      console.log(`TripMapView: Successfully decoded ${coordinates.length} points from polyline`);
      return coordinates;
    } catch (error) {
      console.error('TripMapView: Error decoding polyline:', error);
      return [];
    }
  }

  private addBasicLines(coordinates: LngLatLike[]): void {
    if (coordinates.length < 2) {
      return;
    }

    console.log('TripMapView: Adding basic lines between stops');

    // Convert LngLatLike[] to number[][] for GeoJSON
    const geoJsonCoordinates: number[][] = coordinates.map(coord => {
      if (Array.isArray(coord)) {
        return coord as number[];
      } else {
        // LngLat object
        return [(coord as any).lng, (coord as any).lat];
      }
    });

    // Create a single line connecting all stops in order
    if (this.mapStyleLoaded) {
      const sourceId = 'basic-route';
      const layerId = 'basic-route';

      if (!this.map.getSource(sourceId)) {
        this.map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: geoJsonCoordinates
            }
          }
        });
      }

      if (!this.map.getLayer(layerId)) {
        this.map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ff6b35',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        });
      }
    }
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Clear any existing route layers only if style is loaded
    if (this.mapStyleLoaded && this.map.getStyle()) {
      const layers = this.map.getStyle().layers;
      if (layers) {
        layers.forEach(layer => {
          if ((layer.id.startsWith('route-') || layer.id === 'basic-route') && this.map.getLayer(layer.id)) {
            this.map.removeLayer(layer.id);
            if (this.map.getSource(layer.id)) {
              this.map.removeSource(layer.id);
            }
          }
        });
      }
    }
  }

  /**
   * Check polyline status for the current trip and automatically generate if needed
   */
  private checkPolylineStatus(): void {
    this.tripDataService.getPolylineStatus().subscribe({
      next: (status) => {
        this.polylineStatus.set(status);
        console.log('TripMapView: Polyline status:', status);
        
        // Automatically generate polylines if needed
        if (status.needsPolylines && !this.tripDataService.isGeneratingPolylines()) {
          console.log('TripMapView: Auto-generating polylines for map visualization');
          this.generatePolylines();
        }
      },
      error: (error) => {
        console.error('TripMapView: Error checking polyline status:', error);
      }
    });
  }

  /**
   * Generate polylines for the current trip
   */
  generatePolylines(): void {
    console.log('TripMapView: Generating polylines for current trip');
    
    this.tripDataService.generatePolylines().subscribe({
      next: (updatedTrip) => {
        console.log('TripMapView: Polylines generated successfully');
        // Trip state is automatically updated by TripDataService
        // Map will update automatically via the effect
        
        // Refresh polyline status
        this.checkPolylineStatus();
      },
      error: (error) => {
        console.error('TripMapView: Error generating polylines:', error);
        // Error is handled by TripDataService and exposed via signals
      }
    });
  }

  /**
   * Clear polyline generation error
   */
  clearPolylineError(): void {
    this.tripDataService.clearPolylineError();
  }
}

import {
  Component,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map, NavigationControl, Marker, LngLatLike, Popup, LngLatBounds } from 'mapbox-gl';
import {
  PolylineGenerationService,
  PolylineStatus,
} from '../../services/polyline-generation.service';
import { environment } from '../../../../../environments/environment';
import { Trip } from '@trip-planner/types';

@Component({
  selector: 'app-trip-map-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-container animate-fade-in-fast">
      <div #mapContainer class="map animate-scale-in"></div>
    </div>
  `,
  styleUrls: ['./trip-map-view.component.css'],
})
export class TripMapViewComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  trip = input<Trip | null>(null);

  private readonly polylineGenerationService = inject(PolylineGenerationService);
  private map!: Map;
  private markers: Marker[] = [];
  private mapStyleLoaded = false;
  private currentTripId: string | null = null;
  private polylineCheckInProgress = false;
  private mapInitialized = false;

  // Public state for UI
  polylineStatus = signal<PolylineStatus | null>(null);

  ngOnInit(): void {
    // Check if we already have trip data available
    const currentTrip = this.trip();
    if (currentTrip && currentTrip.stops && currentTrip.stops.length > 0) {
      // Initialize map with optimal bounds based on trip data
      const bounds = this.calculateInitialMapBounds(currentTrip);
      this.initializeMap(bounds.center, bounds.zoom);
    } else {
      // No trip data yet, defer initialization until trip is available
      // (ngOnChanges will handle map creation when trip arrives)
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // React to trip input changes
    if (changes['trip'] && changes['trip'].currentValue) {
      const newTrip = changes['trip'].currentValue as Trip;

      // Only process if it's a different trip
      if (this.currentTripId !== newTrip.id) {
        console.log('TripMapView: New trip received:', newTrip.id);
        this.currentTripId = newTrip.id;

        // If map hasn't been initialized yet and we have trip data, initialize it now
        if (!this.mapInitialized && newTrip.stops && newTrip.stops.length > 0) {
          const bounds = this.calculateInitialMapBounds(newTrip);
          this.initializeMap(bounds.center, bounds.zoom);
        } else if (this.mapStyleLoaded) {
          // Map already exists, just update the data
          this.updateMapWithTripData(newTrip);
          this.checkPolylineStatusIfNeeded(newTrip);
        } else {
          // Map initialization in progress, trip will be processed when map loads
          console.log('TripMapView: Map not ready, will process trip after load');
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(center: LngLatLike = [0, 0], zoom: number = 2): void {
    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom,
      accessToken: environment.mapboxAccessToken,
    });

    this.map.addControl(new NavigationControl());

    this.map.once('load', () => {
      console.log('TripMapView: Map fully loaded and ready');
      this.mapStyleLoaded = true;
      this.mapInitialized = true;

      // Process current trip if available
      const currentTrip = this.trip();
      if (currentTrip) {
        this.updateMapWithTripData(currentTrip);
        this.checkPolylineStatusIfNeeded(currentTrip);
      }
    });
  }

  private updateMapWithTripData(trip: Trip): void {
    console.log('TripMapView: Updating map with trip data:', trip.id);
    console.log('TripMapView: Trip travelSegments:', trip.travelSegments);

    // Clear previous trip data
    this.clearMapData();

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
          .setPopup(
            new Popup().setHTML(`
            <h3>${stop.location?.name || 'Stop ' + (index + 1)}</h3>
            <p>${stop.location?.address || ''}</p>
          `),
          )
          .addTo(this.map);

        this.markers.push(marker);
      }
    });

    // Fit map to show all markers (only if needed - skip if map was pre-initialized with correct bounds)
    if (coordinates.length > 0) {
      // Check if map was initialized with optimal bounds already
      const currentCenter = this.map.getCenter();
      const currentZoom = this.map.getZoom();
      const optimalBounds = this.calculateInitialMapBounds(trip);
      
      // Calculate distance between current center and optimal center
      const currentLng = currentCenter.lng;
      const currentLat = currentCenter.lat;
      const optimalLng = Array.isArray(optimalBounds.center) ? optimalBounds.center[0] : 
        'lng' in optimalBounds.center ? optimalBounds.center.lng : optimalBounds.center.lon;
      const optimalLat = Array.isArray(optimalBounds.center) ? optimalBounds.center[1] : optimalBounds.center.lat;
      
      const distance = Math.sqrt(
        Math.pow(currentLng - optimalLng, 2) + Math.pow(currentLat - optimalLat, 2)
      );
      const zoomDifference = Math.abs(currentZoom - optimalBounds.zoom);
      
      // Only adjust if current position is significantly different from optimal
      if (distance > 0.01 || zoomDifference > 1) {
        this.fitMapToCoordinates(coordinates);
      }
    }

    // Check if we have any polylines available and add them
    const hasAnyPolylines = trip.travelSegments && 
                           trip.travelSegments.length > 0 && 
                           trip.travelSegments.some(s => s.polyline);

    console.log('TripMapView: Has polylines:', hasAnyPolylines);

    if (hasAnyPolylines) {
      // Add polylines from travel segments
      this.addPolylines(trip);
      console.log('TripMapView: Added polylines for visualization');
    } else {
      console.log('TripMapView: No polylines available, map will show markers only');
    }
  }

  private calculateInitialMapBounds(trip: Trip): { center: LngLatLike; zoom: number } {
    if (!trip.stops || trip.stops.length === 0) {
      // Fallback to world view if no stops
      return { center: [0, 0], zoom: 2 };
    }

    const coordinates: LngLatLike[] = trip.stops
      .filter(stop => stop.location?.latitude && stop.location?.longitude)
      .map(stop => [stop.location!.longitude, stop.location!.latitude]);

    if (coordinates.length === 0) {
      return { center: [0, 0], zoom: 2 };
    }

    if (coordinates.length === 1) {
      return { center: coordinates[0], zoom: 14 };
    }

    // Calculate center point of all coordinates
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new LngLatBounds(coordinates[0], coordinates[0]),
    );

    const center: LngLatLike = bounds.getCenter().toArray() as [number, number];
    
    // Calculate appropriate zoom level based on bounds size
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latDiff = Math.abs(ne.lat - sw.lat);
    const lngDiff = Math.abs(ne.lng - sw.lng);
    const maxDiff = Math.max(latDiff, lngDiff);
    
    // Estimate zoom level (rough approximation)
    let zoom = 10;
    if (maxDiff < 0.01) zoom = 15;
    else if (maxDiff < 0.1) zoom = 12;
    else if (maxDiff < 1) zoom = 9;
    else if (maxDiff < 5) zoom = 7;
    else if (maxDiff < 10) zoom = 5;
    else zoom = 3;
    
    return { center, zoom };
  }

  private fitMapToCoordinates(coordinates: LngLatLike[]): void {
    if (coordinates.length === 1) {
      this.map.setCenter(coordinates[0]);
      this.map.setZoom(14);
    } else {
      const bounds = coordinates.reduce(
        (bounds, coord) => {
          return bounds.extend(coord);
        },
        new LngLatBounds(coordinates[0], coordinates[0]),
      );

      this.map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 15,
      });
    }
  }

  private clearMapData(): void {
    // Clear markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Clear polyline layers and sources safely
    if (this.mapStyleLoaded && this.map.getStyle()) {
      const layersToRemove: string[] = [];
      const sourcesToRemove: string[] = [];

      // Collect polyline layer and source IDs
      const layers = this.map.getStyle().layers || [];
      layers.forEach(layer => {
        if (layer.id.startsWith('route-')) {
          layersToRemove.push(layer.id);
        }
      });

      const sources = this.map.getStyle().sources || {};
      Object.keys(sources).forEach(sourceId => {
        if (sourceId.startsWith('route-')) {
          sourcesToRemove.push(sourceId);
        }
      });

      // Remove layers first, then sources
      layersToRemove.forEach(layerId => {
        if (this.map.getLayer(layerId)) {
          this.map.removeLayer(layerId);
        }
      });

      sourcesToRemove.forEach(sourceId => {
        if (this.map.getSource(sourceId)) {
          this.map.removeSource(sourceId);
        }
      });
    }
  }

  private addPolylines(trip: Trip): void {
    if (!trip.travelSegments || trip.travelSegments.length === 0) {
      console.log('TripMapView: No travel segments found');
      return;
    }

    console.log('TripMapView: Processing', trip.travelSegments.length, 'travel segments');
    
    let polylinesAdded = 0;

    trip.travelSegments.forEach((segment, index: number) => {
      console.log(`TripMapView: Segment ${index}:`, {
        hasPolyline: !!segment.polyline,
        polylineLength: segment.polyline?.length || 0,
        polylinePreview: segment.polyline?.substring(0, 50) + '...'
      });

      if (!segment.polyline) {
        console.log(`TripMapView: Segment ${index} has no polyline, skipping`);
        return;
      }

      try {
        const coordinates = this.decodePolyline(segment.polyline);
        console.log(`TripMapView: Decoded ${coordinates.length} coordinates for segment ${index}`);
        
        if (coordinates.length === 0) {
          console.warn(`TripMapView: No coordinates decoded for segment ${index}`);
          return;
        }

        const sourceId = `route-${index}`;
        const layerId = `route-${index}`;

        // Add source
        if (!this.map.getSource(sourceId)) {
          this.map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates,
              },
            },
          });
          console.log(`TripMapView: Added source ${sourceId}`);
        }

        // Add layer
        if (!this.map.getLayer(layerId)) {
          this.map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4,
            },
          });
          console.log(`TripMapView: Added layer ${layerId}`);
          polylinesAdded++;
        }
      } catch (error) {
        console.error(`TripMapView: Failed to decode polyline for segment ${index}:`, error);
      }
    });

    console.log(`TripMapView: Successfully added ${polylinesAdded} polylines to map`);
  }


  private checkPolylineStatusIfNeeded(trip: Trip): void {
    // Prevent duplicate polyline checks
    if (this.polylineCheckInProgress) {
      console.log('TripMapView: Polyline check already in progress, skipping');
      return;
    }

    // Only check if trip has stops but no polylines
    if (!trip.stops || trip.stops.length < 2) {
      return;
    }

    const hasPolylines = trip.travelSegments?.some(segment => segment.polyline);
    if (hasPolylines) {
      console.log('TripMapView: Trip already has polylines, skipping check');
      return;
    }

    this.polylineCheckInProgress = true;
    console.log('TripMapView: Checking polyline status for trip:', trip.id);

    this.polylineGenerationService.getPolylineStatus(trip.id).subscribe({
      next: status => {
        this.polylineStatus.set(status);
        console.log('TripMapView: Polyline status:', status);

        // Auto-generate if needed and not already generating
        if (status.needsPolylines && !this.polylineGenerationService.isGenerating()) {
          console.log('TripMapView: Auto-generating polylines for map visualization');
          this.generatePolylines(trip.id);
        } else {
          this.polylineCheckInProgress = false;
        }
      },
      error: error => {
        console.error('TripMapView: Error checking polyline status:', error);
        this.polylineCheckInProgress = false;
      },
    });
  }

  private generatePolylines(tripId: string): void {
    console.log('TripMapView: Generating polylines for trip:', tripId);

    this.polylineGenerationService.generatePolylines(tripId).subscribe({
      next: updatedTrip => {
        console.log('TripMapView: Polylines generated successfully');
        // Update the map with new polyline data
        this.updateMapWithTripData(updatedTrip);
        this.polylineCheckInProgress = false;
      },
      error: error => {
        console.error('TripMapView: Error generating polylines:', error);
        this.polylineCheckInProgress = false;
      },
    });
  }

  private decodePolyline(polyline: string): number[][] {
    if (!polyline || polyline.length === 0) {
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

        const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
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

        const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lng += deltaLng;

        coordinates.push([lng / 1e5, lat / 1e5]);
      }

      return coordinates;
    } catch (error) {
      console.error('TripMapView: Error decoding polyline:', error);
      return [];
    }
  }
}

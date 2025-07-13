import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TripDataService } from '../../services/trip-data.service';
import { TripTimezoneService } from '../../services/trip-timezone.service';
import { Stop, TravelSegment } from '@trip-planner/types';
import { formatDateInLocationTimezone } from '@trip-planner/date-utils';

interface TimelineEvent {
  id: string;
  type: 'stop' | 'segment';
  order: number;
  data: Stop | TravelSegment;
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  description: string;
  time?: string;
}

@Component({
  selector: 'app-timeline-view',
  standalone: true,
  imports: [CommonModule, TimelineModule, CardModule, ButtonModule],
  templateUrl: './timeline-view.component.html',
  styleUrl: './timeline-view.component.css'
})
export class TimelineViewComponent {
  private tripDataService = inject(TripDataService);
  private tripTimezoneService = inject(TripTimezoneService);

  // Trip data
  trip = this.tripDataService.currentTrip;
  stops = this.tripDataService.sortedStops;
  segments = this.tripDataService.travelSegments;
  isLoading = this.tripDataService.isLoading;

  // Timeline events computed from stops and segments
  timelineEvents = computed(() => {
    const stops = this.stops();
    const segments = this.segments();
    const events: TimelineEvent[] = [];

    // Sort stops by order
    const sortedStops = [...stops].sort((a, b) => a.order - b.order);

    sortedStops.forEach((stop, index) => {
      // Add stop event
      const stopEvent: TimelineEvent = {
        id: `stop-${stop.id}`,
        type: 'stop',
        order: stop.order * 2, // Even numbers for stops
        data: stop,
        icon: this.getStopIcon(stop),
        color: this.getStopColor(stop),
        title: stop.location?.name || 'Unknown Location',
        subtitle: this.formatStopTiming(stop),
        description: stop.notes || '',
        time: this.formatStopTime(stop)
      };
      events.push(stopEvent);

      // Add travel segment event if there's a next stop
      if (index < sortedStops.length - 1) {
        const nextStop = sortedStops[index + 1];
        const segment = segments.find(s =>
          s.originStopId === stop.id && s.destinationStopId === nextStop.id
        );

        if (segment) {
          const segmentEvent: TimelineEvent = {
            id: `segment-${segment.id}`,
            type: 'segment',
            order: stop.order * 2 + 1, // Odd numbers for segments
            data: segment,
            icon: this.getSegmentIcon(segment),
            color: '#6b7280', // Muted gray
            title: 'Travel',
            subtitle: this.formatSegmentInfo(segment),
            description: segment.notes || ''
          };
          events.push(segmentEvent);
        }
      }
    });

    return events.sort((a, b) => a.order - b.order);
  });

  private getStopIcon(stop: Stop): string {
    switch (stop.stopType) {
      case 'OVERNIGHT':
        return 'pi pi-moon';
      case 'PITSTOP':
        return 'pi pi-map-marker';
      default:
        return 'pi pi-circle';
    }
  }

  private getStopColor(stop: Stop): string {
    switch (stop.stopType) {
      case 'OVERNIGHT':
        return '#3b82f6'; // Blue
      case 'PITSTOP':
        return '#10b981'; // Green
      default:
        return '#8b5cf6'; // Purple
    }
  }

  private getSegmentIcon(segment: TravelSegment): string {
    switch (segment.travelMode) {
      case 'DRIVING':
        return 'pi pi-car';
      case 'WALKING':
        return 'pi pi-user';
      case 'BICYCLING':
        return 'pi pi-send';
      case 'TRANSIT':
      case 'PUBLIC_TRANSPORT':
        return 'pi pi-truck';
      default:
        return 'pi pi-arrow-right';
    }
  }

  private formatStopTiming(stop: Stop): string {
    const duration = stop.plannedDuration;
    if (duration) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    return 'No duration set';
  }

  private formatStopTime(stop: Stop): string | undefined {
    if (stop.plannedArrivalTime && stop.location) {
      return formatDateInLocationTimezone(
        stop.plannedArrivalTime,
        stop.location,
        'MMM d, h:mm a',
        false
      );
    }
    if (stop.calculatedArrivalTime && stop.location) {
      return formatDateInLocationTimezone(
        stop.calculatedArrivalTime,
        stop.location,
        'MMM d, h:mm a',
        false
      );
    }
    return undefined;
  }

  private formatSegmentInfo(segment: TravelSegment): string {
    const distance = segment.distance || segment.apiCalculatedDistance;
    const duration = segment.duration || segment.apiCalculatedDuration;

    const parts: string[] = [];

    if (distance) {
      const km = Math.round(distance / 1000);
      parts.push(`${km} km`);
    }

    if (duration) {
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;
      if (hours > 0) {
        parts.push(`${hours}h ${minutes}m`);
      } else {
        parts.push(`${minutes}m`);
      }
    }

    return parts.length > 0 ? parts.join(' • ') : 'No travel info';
  }

  onStopDetailsRequested(stop: Stop): void {
    // TODO: Open stop details modal
    console.log('Stop details requested for:', stop);
  }

  onSegmentNotesRequested(segment: TravelSegment): void {
    // TODO: Open segment notes modal
    console.log('Segment notes requested for:', segment);
  }

  getStopCountByType(type: string): number {
    return this.stops().filter(stop => stop.stopType === type).length;
  }
}

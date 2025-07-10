import { Injectable, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { Trip, Location, Stop } from '@trip-planner/types';
import {
  convertDateToLocationTimezone,
  formatDateTimeWithTimezone,
  getTripPrimaryTimezone,
  getLocationTimezoneDisplayName,
  convertTimezoneAwareDateToUTC,
  validateTripTimingAcrossTimezones,
  suggestStopTiming,
  getTimezoneOffset,
  isSameDayAcrossTimezones,
} from '@trip-planner/date-utils';

export interface StopWithTimezoneInfo extends Stop {
  timezoneDisplayName: string;
  localPlannedArrivalTime: DateTime | null;
  localCalculatedArrivalTime: DateTime | null;
  localCalculatedDepartureTime: DateTime | null;
}

export interface TripDurationInfo {
  duration: number;
  startTimezone: string;
  endTimezone: string;
  isMultiTimezone: boolean;
}

export interface TimezoneValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

@Injectable({
  providedIn: 'root',
})
export class TripTimezoneService {
  private readonly _currentTrip = signal<Trip | null>(null);

  /**
   * Set the current trip for timezone calculations
   */
  setCurrentTrip(trip: Trip | null): void {
    this._currentTrip.set(trip);
  }

  /**
   * Get the primary timezone for the current trip
   */
  getTripPrimaryTimezone(trip?: Trip | null): string {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip || !targetTrip.stops.length) return 'UTC';
    
    const sortedStops = [...targetTrip.stops].sort((a, b) => a.order - b.order);
    return getTripPrimaryTimezone(sortedStops);
  }

  /**
   * Get the display name for the trip's primary timezone
   */
  getTripPrimaryTimezoneDisplayName(trip?: Trip | null): string {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip || !targetTrip.stops.length) return 'UTC';
    
    const sortedStops = [...targetTrip.stops].sort((a, b) => a.order - b.order);
    const firstStop = sortedStops[0];
    if (!firstStop.location) return 'UTC';
    
    return getLocationTimezoneDisplayName(firstStop.location);
  }

  /**
   * Get stops with timezone information
   */
  getStopsWithTimezoneInfo(trip?: Trip | null): StopWithTimezoneInfo[] {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip) return [];
    
    const sortedStops = [...targetTrip.stops].sort((a, b) => a.order - b.order);
    return sortedStops.map(stop => ({
      ...stop,
      timezoneDisplayName: stop.location ? getLocationTimezoneDisplayName(stop.location) : 'UTC',
      localPlannedArrivalTime: stop.plannedArrivalTime && stop.location?.timezone
        ? convertDateToLocationTimezone(stop.plannedArrivalTime, stop.location)
        : null,
      localCalculatedArrivalTime: stop.calculatedArrivalTime && stop.location?.timezone
        ? convertDateToLocationTimezone(stop.calculatedArrivalTime, stop.location)
        : null,
      localCalculatedDepartureTime: stop.calculatedDepartureTime && stop.location?.timezone
        ? convertDateToLocationTimezone(stop.calculatedDepartureTime, stop.location)
        : null,
    }));
  }

  /**
   * Format trip start date in trip's primary timezone
   */
  formatTripStartDate(trip?: Trip | null): DateTime | null {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip?.startDate) return null;
    
    const primaryTimezone = this.getTripPrimaryTimezone(targetTrip);
    if (primaryTimezone === 'UTC') return DateTime.fromJSDate(targetTrip.startDate);
    
    return convertDateToLocationTimezone(targetTrip.startDate, { timezone: primaryTimezone });
  }

  /**
   * Format trip end date in trip's primary timezone
   */
  formatTripEndDate(trip?: Trip | null): DateTime | null {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip?.endDate) return null;
    
    const primaryTimezone = this.getTripPrimaryTimezone(targetTrip);
    if (primaryTimezone === 'UTC') return DateTime.fromJSDate(targetTrip.endDate);
    
    return convertDateToLocationTimezone(targetTrip.endDate, { timezone: primaryTimezone });
  }

  /**
   * Calculate trip duration with timezone awareness
   */
  calculateTripDurationInTimezone(trip?: Trip | null): TripDurationInfo | null {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip) return null;
    
    const sortedStops = [...targetTrip.stops].sort((a, b) => a.order - b.order);
    if (sortedStops.length === 0) return null;

    const firstStop = sortedStops[0];
    const lastStop = sortedStops[sortedStops.length - 1];

    if (!firstStop.calculatedArrivalTime || !lastStop.calculatedDepartureTime) {
      return null;
    }

    // Convert times to location timezone for more accurate duration calculation
    const firstStopTimezone = firstStop.location?.timezone || 'UTC';
    const lastStopTimezone = lastStop.location?.timezone || 'UTC';

    const start = convertDateToLocationTimezone(firstStop.calculatedArrivalTime, { timezone: firstStopTimezone });
    const end = convertDateToLocationTimezone(lastStop.calculatedDepartureTime, { timezone: lastStopTimezone });

    return {
      duration: end.diff(start, 'milliseconds').milliseconds,
      startTimezone: firstStopTimezone,
      endTimezone: lastStopTimezone,
      isMultiTimezone: firstStopTimezone !== lastStopTimezone,
    };
  }

  /**
   * Convert trip dates to UTC for backend storage
   */
  convertTripDatesToUTC(
    startDate: Date | null,
    endDate: Date | null,
    timezone?: string,
    trip?: Trip | null
  ): { startDate: Date | null; endDate: Date | null } {
    const targetTimezone = timezone || this.getTripPrimaryTimezone(trip);
    
    let utcStartDate = startDate;
    let utcEndDate = endDate;
    
    if (targetTimezone !== 'UTC') {
      if (startDate) {
        const startDateTime = convertDateToLocationTimezone(startDate, { timezone: targetTimezone });
        utcStartDate = startDateTime.setZone('UTC').toJSDate();
      }
      if (endDate) {
        const endDateTime = convertDateToLocationTimezone(endDate, { timezone: targetTimezone });
        utcEndDate = endDateTime.setZone('UTC').toJSDate();
      }
    }
    
    return { startDate: utcStartDate, endDate: utcEndDate };
  }

  /**
   * Convert stop timing to UTC for backend storage
   */
  convertStopTimingToUTC(
    stopLocation: Location,
    timing: {
      plannedArrivalTime?: Date | null;
      plannedDuration?: number | null;
    }
  ): { plannedArrivalTime?: Date | null; plannedDuration?: number | null } {
    const locationTimezone = stopLocation.timezone || 'UTC';
    const utcTiming = { ...timing };

    if (timing.plannedArrivalTime && locationTimezone !== 'UTC') {
      const arrivalDateTime = convertDateToLocationTimezone(timing.plannedArrivalTime, { timezone: locationTimezone });
      utcTiming.plannedArrivalTime = arrivalDateTime.setZone('UTC').toJSDate();
    }

    return utcTiming;
  }

  /**
   * Format date time with timezone for display
   */
  formatDateTimeWithTimezone(
    date: Date,
    location: Location,
    format = 'yyyy-MM-dd HH:mm',
    includeZone = true
  ): string {
    const dt = convertDateToLocationTimezone(date, location);
    return formatDateTimeWithTimezone(dt, format, includeZone);
  }

  /**
   * Validate trip timing across timezones
   */
  validateTripTimingAcrossTimezones(trip?: Trip | null): TimezoneValidationResult {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip) return { isValid: true, warnings: [], errors: [] };
    
    const sortedStops = [...targetTrip.stops].sort((a, b) => a.order - b.order);
    return validateTripTimingAcrossTimezones(sortedStops);
  }

  /**
   * Suggest optimal timing for a stop
   */
  suggestStopTiming(
    location: Location,
    previousStopDeparture?: DateTime | null,
    stopType?: 'PITSTOP' | 'OVERNIGHT' | null,
    travelDuration?: number
  ) {
    return suggestStopTiming(location, previousStopDeparture, stopType, travelDuration);
  }

  /**
   * Get timezone offset between two locations
   */
  getTimezoneOffset(
    time: DateTime,
    fromLocation: Location,
    toLocation: Location
  ) {
    return getTimezoneOffset(time, fromLocation, toLocation);
  }

  /**
   * Check if two times are in the same day across different timezones
   */
  isSameDayAcrossTimezones(time1: DateTime, time2: DateTime): boolean {
    return isSameDayAcrossTimezones(time1, time2);
  }

  /**
   * Get timezone display name for a location
   */
  getLocationTimezoneDisplayName(location: Location): string {
    return getLocationTimezoneDisplayName(location);
  }

  /**
   * Convert date to location timezone
   */
  convertDateToLocationTimezone(date: Date, location: Location): DateTime {
    return convertDateToLocationTimezone(date, location);
  }

  /**
   * Check if trip spans multiple timezones
   */
  isMultiTimezoneTrip(trip?: Trip | null): boolean {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip) return false;
    
    const timezones = new Set(
      targetTrip.stops
        .map(stop => stop.location?.timezone)
        .filter(Boolean)
    );
    
    return timezones.size > 1;
  }

  /**
   * Get all unique timezones in the trip
   */
  getTripTimezones(trip?: Trip | null): string[] {
    const targetTrip = trip || this._currentTrip();
    if (!targetTrip) return [];
    
    const timezones = new Set(
      targetTrip.stops
        .map(stop => stop.location?.timezone)
        .filter(Boolean) as string[]
    );
    
    return Array.from(timezones).sort();
  }

  /**
   * Convert timezone-aware DateTime to UTC Date for API requests
   */
  convertTimezoneAwareDateToUTC(dt: DateTime): Date {
    return convertTimezoneAwareDateToUTC(dt);
  }
}
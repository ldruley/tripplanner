import { DateTime } from 'luxon';
// Define minimal types to avoid circular dependencies
export interface Location {
  timezone?: string | null;
}

export interface Stop {
  location?: Location | null;
  plannedArrivalTime?: Date | null;
  calculatedArrivalTime?: Date | null;
  calculatedDepartureTime?: Date | null;
  plannedDuration?: number | null;
}

/**
 * Parses a date string using a specified format.
 * @param dateString - The date string to parse.
 * @param format - The format string (e.g., 'MM/dd/yyyy HH:mm').
 * @param zone - Optional timezone to apply to the DateTime object.
 * @returns A DateTime object or null if parsing fails or the result is invalid.
 */
export function parseDateTimeFromFormat(dateString: string, format: string, zone?: string): DateTime | null {
  const dt = DateTime.fromFormat(dateString, format, { zone });
  return dt.isValid ? dt : null;
}

/**
 * Converts a date string to a DateTime object using Luxon.
 * @param dateString - The date string to convert.
 * @param zone - Optional timezone to apply to the DateTime object.
 * @returns A DateTime object or null if the conversion fails.
 */
export function parseDateString(dateString: string, zone?: string): DateTime | null {
  try {
    // Attempt to parse the date string using Luxon
    const dt = DateTime.fromISO(dateString, { zone: zone });
    // Check if the parsed date is valid
    return dt.isValid ? dt : null;
  } catch (error) {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Sets a timezone on a DateTime object if it is not already set.
 * @param dt - The DateTime object to modify.
 * @param zone - The timezone to set on the DateTime object.
 * @returns A new DateTime object with the specified timezone, or the original if it already has a timezone.
 */
export function setTimezoneIfUnset(dt: DateTime, zone: string): DateTime {
  // If the DateTime object already has a zone set, return it as is
  if (dt.zone.name !== 'local' && dt.zone.name !== 'utc') {
    return dt;
  }

  // If the DateTime object is in local or UTC time, set the new timezone
  return dt.setZone(zone);
}

/**
 * Create a DateTime from a JS Date object
 * @param date - The JavaScript Date object to convert.
 * @param zone - Optional timezone to apply to the DateTime object.
 * @returns A DateTime object representing the provided date in the specified timezone.
 * */
export function fromJSDate(date: Date, zone?: string): DateTime {
  return DateTime.fromJSDate(date, { zone });
}

/**
 * Create a DateTime from individual date and time components.
 * @param year - The year component.
 * @param month - The month component (1-12).
 * @param day - The day component (1-31).
 * @param hour - The hour component (0-23). Defaults to 0.
 * @param minute - The minute component (0-59). Defaults to 0.
 * @param zone - Optional timezone to apply to the DateTime object. Defaults to 'UTC'.
 * @returns A DateTime object representing the specified date and time in the given timezone.
 */
export function createDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  zone = 'UTC',
): DateTime {
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone });
}

/**
 * Formats a DateTime object into a string using the specified format and locale.
 * @param dt - The DateTime object to format.
 * @param format - The format string (default: 'yyyy-MM-dd HH:mm').
 * @param locale - The locale to use for formatting (default: 'en-US').
 * @returns A formatted date string.
 */
export function formatDateTime(
  dt: DateTime,
  format = 'yyyy-MM-dd HH:mm',
  locale = 'en-US',
): string {
  return dt.setLocale(locale).toFormat(format);
}

/**
 * Formats a DateTime object into a relative time against the current time.
 * @param dt - The DateTime object to format.
 * @returns A formatted date string.
 */
export function formatRelativeToNow(dt: DateTime): string {
  return dt.toRelative({ base: DateTime.now() }) ?? '';
}

/**
 * Adds a specified number of days to a DateTime object.
 * @param dt - The DateTime object to modify.
 * @param days - The number of days to add (can be negative to subtract).
 * @returns A new DateTime object with the added days.
 */
export function addDays(dt: DateTime, days: number): DateTime {
  return dt.plus({ days });
}

/**
 * Calculates the difference in minutes between two DateTime objects.
 * @param start
 * @param end
 */
export function diffInMinutes(start: DateTime, end: DateTime): number {
  return end.diff(start, 'minutes').minutes;
}

/**
 * Calculates the difference in seconds between two DateTime objects.
 * @param start
 * @param end
 */
export function diffInSeconds(start: DateTime, end: DateTime): number {
  return end.diff(start, 'seconds').seconds;
}

/**
 * Checks if a given date string is in ISO format and valid.
 * @param dateString - The date string to validate.
 * @returns true if the date string is a valid ISO date, false otherwise.
 */
export function isValidISODate(dateString: string): boolean {
  return DateTime.fromISO(dateString).isValid;
}

/**
 * Returns the current date and time in the specified timezone.
 * @param zone - The timezone to use (e.g., 'America/New_York', 'Europe/Berlin').
 * @returns A DateTime object representing the current date and time in the specified timezone.
 */
export function nowInZone(zone: string): DateTime {
  return DateTime.now().setZone(zone);
}

/**
 * Converts a DateTime from one timezone to another.
 * @param dt - The DateTime object to convert.
 * @param targetZone - The target timezone (e.g., 'America/New_York', 'Europe/Berlin').
 * @returns A new DateTime object in the target timezone.
 */
export function convertToTimezone(dt: DateTime, targetZone: string): DateTime {
  return dt.setZone(targetZone);
}

/**
 * Converts a DateTime to UTC timezone.
 * @param dt - The DateTime object to convert.
 * @returns A new DateTime object in UTC.
 */
export function convertToUTC(dt: DateTime): DateTime {
  return dt.setZone('UTC');
}

/**
 * Converts a UTC DateTime to a specific timezone.
 * @param utcDateTime - The UTC DateTime object to convert.
 * @param targetZone - The target timezone (e.g., 'America/New_York', 'Europe/Berlin').
 * @returns A new DateTime object in the target timezone.
 */
export function convertFromUTC(utcDateTime: DateTime, targetZone: string): DateTime {
  return utcDateTime.setZone(targetZone);
}

/**
 * Converts a JavaScript Date object to a DateTime in a specific timezone.
 * @param date - The JavaScript Date object (typically from backend API).
 * @param targetZone - The target timezone to convert to.
 * @returns A DateTime object in the target timezone.
 */
export function convertDateToTimezone(date: Date, targetZone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(targetZone);
}

/**
 * Converts a DateTime to a JavaScript Date object in UTC.
 * @param dt - The DateTime object to convert.
 * @returns A JavaScript Date object in UTC for API requests.
 */
export function convertToUTCDate(dt: DateTime): Date {
  return dt.setZone('UTC').toJSDate();
}

/**
 * Formats a DateTime with timezone information.
 * @param dt - The DateTime object to format.
 * @param format - The format string (default: 'yyyy-MM-dd HH:mm').
 * @param includeZone - Whether to include timezone abbreviation (default: true).
 * @returns A formatted date string with timezone information.
 */
export function formatDateTimeWithTimezone(
  dt: DateTime,
  format = 'yyyy-MM-dd HH:mm',
  includeZone = true,
): string {
  const formattedDate = dt.toFormat(format);
  if (includeZone) {
    const zoneAbbr = dt.toFormat('ZZZZ');
    return `${formattedDate} ${zoneAbbr}`;
  }
  return formattedDate;
}

/**
 * Gets the timezone abbreviation for a DateTime.
 * @param dt - The DateTime object.
 * @returns The timezone abbreviation (e.g., 'EST', 'PDT').
 */
export function getTimezoneAbbreviation(dt: DateTime): string {
  return dt.toFormat('ZZZZ');
}

/**
 * Determines if a DateTime is in a different timezone than the system timezone.
 * @param dt - The DateTime object to check.
 * @returns True if the DateTime is in a different timezone.
 */
export function isInDifferentTimezone(dt: DateTime): boolean {
  const systemZone = DateTime.now().zoneName;
  return dt.zoneName !== systemZone;
}

/**
 * Gets the timezone offset in minutes for a DateTime.
 * @param dt - The DateTime object.
 * @returns The timezone offset in minutes.
 */
export function getTimezoneOffsetMinutes(dt: DateTime): number {
  return dt.offset;
}

/**
 * Creates a DateTime from date and time components in a specific timezone.
 * @param year - The year component.
 * @param month - The month component (1-12).
 * @param day - The day component (1-31).
 * @param hour - The hour component (0-23). Defaults to 0.
 * @param minute - The minute component (0-59). Defaults to 0.
 * @param zone - The timezone to create the DateTime in.
 * @returns A DateTime object in the specified timezone.
 */
export function createDateTimeInTimezone(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  zone: string,
): DateTime {
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone });
}

/**
 * Converts a Date object to a DateTime in a location's timezone.
 * @param date - The Date object to convert.
 * @param location - The location object with timezone information.
 * @returns A DateTime object in the location's timezone, or in UTC if no timezone is available.
 */
export function convertDateToLocationTimezone(date: Date, location: Location): DateTime {
  const timezone = location.timezone || 'UTC';
  return DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(timezone);
}

/**
 * Converts a DateTime to UTC for API requests, preserving the original timezone context.
 * @param dt - The DateTime object to convert.
 * @returns A Date object in UTC for backend API requests.
 */
export function convertTimezoneAwareDateToUTC(dt: DateTime): Date {
  return dt.setZone('UTC').toJSDate();
}

/**
 * Determines the primary timezone for a trip based on its first stop.
 * @param stops - Array of stops with location information.
 * @returns The timezone of the first stop, or 'UTC' if no timezone is available.
 */
export function getTripPrimaryTimezone(stops: Stop[]): string {
  if (stops.length === 0) return 'UTC';

  const firstStop = stops.find(stop => stop.location?.timezone);
  return firstStop?.location?.timezone || 'UTC';
}

/**
 * Formats a Date object in a location's timezone.
 * @param date - The Date object to format.
 * @param location - The location object with timezone information.
 * @param format - The format string (default: 'yyyy-MM-dd HH:mm').
 * @param includeZone - Whether to include timezone abbreviation (default: true).
 * @returns A formatted date string in the location's timezone.
 */
export function formatDateInLocationTimezone(
  date: Date,
  location: Location,
  format = 'yyyy-MM-dd HH:mm',
  includeZone = true,
): string {
  const dt = convertDateToLocationTimezone(date, location);
  return formatDateTimeWithTimezone(dt, format, includeZone);
}

/**
 * Checks if a date/time is reasonable for a given location (basic validation).
 * @param dt - The DateTime object to validate.
 * @param location - The location object with timezone information.
 * @returns True if the date/time seems reasonable for the location.
 */
export function isDateTimeReasonableForLocation(dt: DateTime, location: Location): boolean {
  if (!location.timezone) return true; // Skip validation if no timezone

  const locationTime = dt.setZone(location.timezone);
  const hour = locationTime.hour;

  // Basic validation: warn if arrival time is between 11 PM and 5 AM
  return hour >= 5 && hour <= 23;
}

/**
 * Gets the timezone display name for a location.
 * @param location - The location object with timezone information.
 * @returns A human-readable timezone name or 'UTC' if no timezone is available.
 */
export function getLocationTimezoneDisplayName(location: Location): string {
  if (!location.timezone) return 'UTC';

  // Get the timezone abbreviation for current time
  const now = DateTime.now().setZone(location.timezone);
  return now.toFormat('ZZZZ');
}

/**
 * Converts a time input (like from a form) to a DateTime in a location's timezone.
 * @param timeString - The time string from user input (e.g., '14:30' or '2:30 PM').
 * @param baseDate - The base date to combine with the time.
 * @param location - The location object with timezone information.
 * @returns A DateTime object in the location's timezone.
 */
export function parseTimeInLocationTimezone(
  timeString: string,
  baseDate: Date,
  location: Location,
): DateTime | null {
  try {
    const timezone = location.timezone || 'UTC';
    const baseDateTime = DateTime.fromJSDate(baseDate, { zone: timezone });

    // Parse time string (supports both 24-hour and 12-hour formats)
    const timeFormat = timeString.includes('AM') || timeString.includes('PM') ? 'h:mm a' : 'HH:mm';
    const timePart = DateTime.fromFormat(timeString, timeFormat);

    if (!timePart.isValid) return null;

    // Combine date and time in the location's timezone
    return baseDateTime.set({
      hour: timePart.hour,
      minute: timePart.minute,
      second: 0,
      millisecond: 0,
    });
  } catch (error) {
    return null;
  }
}

/**
 * Validates if a trip schedule makes sense across multiple timezones.
 * @param stops - Array of stops with location and timing information.
 * @returns Validation result with issues found.
 */
export function validateTripTimingAcrossTimezones(stops: Stop[]): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    if (!stop.location?.timezone) continue;

    // Check for unreasonable arrival times
    if (stop.plannedArrivalTime) {
      const localTime = convertDateToLocationTimezone(
        stop.plannedArrivalTime,
        stop.location as Location,
      );
      if (!isDateTimeReasonableForLocation(localTime, stop.location as Location)) {
        warnings.push(
          `Stop ${i + 1}: Arrival time ${localTime.toFormat('HH:mm')} might be outside typical hours.`,
        );
      }
    }

    // Check for timezone transitions between consecutive stops
    if (i > 0) {
      const prevStop = stops[i - 1];
      if (prevStop.location?.timezone && prevStop.location.timezone !== stop.location.timezone) {
        warnings.push(
          `Timezone change between stop ${i} and ${i + 1}: ${prevStop.location.timezone} → ${stop.location.timezone}`,
        );
      }

      // Check for unrealistic travel times across time zones
      if (prevStop.calculatedDepartureTime && stop.calculatedArrivalTime) {
        const prevDeparture = convertDateToLocationTimezone(
          prevStop.calculatedDepartureTime,
          prevStop.location as Location,
        );
        const currentArrival = convertDateToLocationTimezone(
          stop.calculatedArrivalTime,
          stop.location as Location,
        );

        const travelTime = currentArrival.diff(prevDeparture, 'hours').hours;

        if (travelTime < 0) {
          errors.push(
            `Stop ${i + 1}: Arrival time is before departure from previous stop (accounting for timezone differences).`,
          );
        } else if (travelTime < 0.5) {
          warnings.push(
            `Stop ${i + 1}: Very short travel time (${Math.round(travelTime * 60)} minutes) between locations in different timezones.`,
          );
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Suggests optimal times for a stop based on location and context.
 * @param location - The location object with timezone information.
 * @param previousStopDeparture - Departure time from previous stop (if any).
 * @param stopType - Type of stop (PITSTOP or OVERNIGHT).
 * @param travelDuration - Travel duration from previous stop in minutes.
 * @returns Suggested timing information.
 */
export function suggestStopTiming(
  location: Location,
  previousStopDeparture?: DateTime | null,
  stopType?: 'PITSTOP' | 'OVERNIGHT' | null,
  travelDuration?: number,
): {
  suggestedArrival: DateTime | null;
  suggestedDuration: number | null;
  reasoning: string;
} {
  const timezone = location.timezone || 'UTC';

  // If we have a previous stop and travel duration, calculate arrival
  if (previousStopDeparture && travelDuration) {
    const arrivalTime = previousStopDeparture.plus({ minutes: travelDuration }).setZone(timezone);

    // Suggest duration based on stop type and arrival time
    let suggestedDuration = 60; // Default 1 hour
    let reasoning = 'Standard stop duration';

    if (stopType === 'OVERNIGHT') {
      suggestedDuration = 12 * 60; // 12 hours for overnight
      reasoning = 'Overnight stop duration';
    } else {
      const hour = arrivalTime.hour;
      if (hour >= 11 && hour <= 14) {
        suggestedDuration = 90; // 1.5 hours for lunch time
        reasoning = 'Extended duration for meal time';
      } else if (hour >= 17 && hour <= 20) {
        suggestedDuration = 120; // 2 hours for dinner time
        reasoning = 'Extended duration for dinner time';
      }
    }

    return {
      suggestedArrival: arrivalTime,
      suggestedDuration,
      reasoning,
    };
  }

  // Default suggestions without previous context
  const now = DateTime.now().setZone(timezone);
  let suggestedArrival = now.plus({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 });

  // Adjust to reasonable hours
  if (suggestedArrival.hour < 8) {
    suggestedArrival = suggestedArrival.set({ hour: 9 });
  } else if (suggestedArrival.hour > 22) {
    suggestedArrival = suggestedArrival.plus({ days: 1 }).set({ hour: 9 });
  }

  return {
    suggestedArrival,
    suggestedDuration: stopType === 'OVERNIGHT' ? 12 * 60 : 60,
    reasoning: 'Default suggestion based on current time',
  };
}

/**
 * Checks if two times are in the same day across different timezones.
 * @param time1 - First DateTime object.
 * @param time2 - Second DateTime object.
 * @returns True if both times represent the same calendar day in their respective timezones.
 */
export function isSameDayAcrossTimezones(time1: DateTime, time2: DateTime): boolean {
  const date1 = time1.toFormat('yyyy-MM-dd');
  const date2 = time2.toFormat('yyyy-MM-dd');
  return date1 === date2;
}

/**
 * Calculates the time difference between two locations accounting for timezone.
 * @param time - The reference time.
 * @param fromLocation - The source location.
 * @param toLocation - The destination location.
 * @returns Time difference information.
 */
export function getTimezoneOffset(
  time: DateTime,
  fromLocation: Location,
  toLocation: Location,
): {
  offsetHours: number;
  offsetMinutes: number;
  description: string;
} {
  const fromTimezone = fromLocation.timezone || 'UTC';
  const toTimezone = toLocation.timezone || 'UTC';

  const timeInFrom = time.setZone(fromTimezone);
  const timeInTo = time.setZone(toTimezone);

  const offsetMinutes = timeInTo.offset - timeInFrom.offset;
  const offsetHours = offsetMinutes / 60;

  let description = '';
  if (offsetHours > 0) {
    description = `${Math.abs(offsetHours)} hours ahead`;
  } else if (offsetHours < 0) {
    description = `${Math.abs(offsetHours)} hours behind`;
  } else {
    description = 'Same timezone';
  }

  return {
    offsetHours,
    offsetMinutes,
    description,
  };
}

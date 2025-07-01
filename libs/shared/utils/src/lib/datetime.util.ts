import { DateTime } from "luxon";

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
  zone = 'UTC'
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
  locale = 'en-US'
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

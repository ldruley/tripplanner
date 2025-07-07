import { Location, Stop, LocationForItinerary } from '@trip-planner/types';

/**
 * Transform a Location object to LocationForItinerary format
 * @param location - The location to transform
 * @param order - The order position for the itinerary
 * @returns LocationForItinerary object
 */
export function locationToLocationForItinerary(
  location: Location,
  order: number
): LocationForItinerary {
  return {
    name: location.name,
    description: location.description,
    address: location.address,
    city: location.city,
    state: location.state,
    country: location.country,
    postalCode: location.postalCode,
    latitude: location.latitude,
    longitude: location.longitude,
    apiSource: location.apiSource,
    apiSourceId: location.apiSourceId,
    category: location.category,
    order
  };
}

/**
 * Transform an array of Stops to LocationForItinerary format
 * @param stops - Array of stops to transform
 * @returns Array of LocationForItinerary objects
 */
export function stopsToLocationForItinerary(stops: Stop[]): LocationForItinerary[] {
  return stops
    .sort((a, b) => a.order - b.order)
    .filter(stop => stop.location !== undefined)
    .map(stop => locationToLocationForItinerary(stop.location!, stop.order));
}

/**
 * Transform a Location object from frontend search/geocoding to LocationForItinerary format
 * This handles locations that might not have all the rich data fields
 * @param location - The location to transform
 * @param order - The order position for the itinerary
 * @returns LocationForItinerary object
 */
export function searchLocationToLocationForItinerary(
  location: Partial<Location> & { name: string; latitude: number; longitude: number },
  order: number
): LocationForItinerary {
  return {
    name: location.name,
    description: location.description || null,
    address: location.address || null,
    city: location.city || null,
    state: location.state || null,
    country: location.country || null,
    postalCode: location.postalCode || null,
    latitude: location.latitude,
    longitude: location.longitude,
    apiSource: location.apiSource || null,
    apiSourceId: location.apiSourceId || null,
    category: location.category || null,
    order
  };
}

/**
 * Extract coordinates from LocationForItinerary objects for matrix routing
 * @param locations - Array of LocationForItinerary objects
 * @returns Array of coordinate objects
 */
export function extractCoordinatesFromLocationForItinerary(
  locations: LocationForItinerary[]
): Array<{ lat: number; lng: number }> {
  return locations.map(location => ({
    lat: location.latitude,
    lng: location.longitude
  }));
}

/**
 * Validate LocationForItinerary object has required fields
 * @param location - LocationForItinerary object to validate
 * @returns true if valid, false otherwise
 */
export function validateLocationForItinerary(location: LocationForItinerary): boolean {
  return (
    typeof location.name === 'string' &&
    location.name.trim().length > 0 &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number' &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    typeof location.order === 'number' &&
    location.order >= 0 &&
    Number.isInteger(location.order)
  );
}
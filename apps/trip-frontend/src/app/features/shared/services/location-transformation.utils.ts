import { Location, Stop, LocationForItinerary } from '@trip-planner/types';

/**
 * Transform a Location object to LocationForItinerary format
 * @param location - The location to transform
 * @param order - The order position for the itinerary
 * @returns LocationForItinerary object
 */
export function locationToLocationForItinerary(
  location: Location,
  order: number,
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
    order,
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

import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { LocationForItinerarySchema } from './location.schema';
import { TravelModeSchema } from './travel-segment.schema';

// Schema for creating a trip from organized locations
export const CreateTripFromOrganizedListSchema = extendApi(
  z.object({
    name: z.string().min(1).max(255).describe('Trip name (1-255 characters)'),
    description: z.string().optional().describe('Optional trip description'),
    startDate: z.string().datetime().optional().describe('Planned start date (ISO 8601 format)'),
    endDate: z.string().datetime().optional().describe('Planned end date (ISO 8601 format)'),
    matrix: z.string().optional().describe('Optional matrix for trip planning (e.g. JSON string)'),
    organizedLocations: z
      .array(LocationForItinerarySchema)
      .min(1)
      .describe('Ordered list of locations to visit (minimum 1)'),
    bankedLocations: z
      .array(LocationForItinerarySchema)
      .optional()
      .default([])
      .describe('List of locations to bank for this trip (optional)'),
    calculateRouting: z
      .boolean()
      .default(true)
      .describe('Whether to calculate routing between locations'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
  }),
  {
    title: 'Create Trip from Organized List',
    description: 'Schema for creating a trip from a pre-organized list of locations',
    example: {
      name: 'Paris Adventure',
      description: 'A day exploring Paris landmarks',
      startDate: '2024-06-01T09:00:00Z',
      endDate: '2024-06-01T18:00:00Z',
      organizedLocations: [
        {
          name: 'Eiffel Tower',
          description: 'Iconic iron lattice tower in Paris',
          address: 'Champ de Mars, 5 Avenue Anatole France',
          city: 'Paris',
          state: 'Île-de-France',
          country: 'France',
          postalCode: '75007',
          latitude: 48.8584,
          longitude: 2.2945,
          apiSource: 'HERE',
          apiSourceId: 'here:pds:place:250jx7ps-b9d7fc1d8dbc4dd9adb39e4b7cf0b2f7',
          category: 'ATTRACTION',
          order: 0,
        },
      ],
      calculateRouting: true,
      travelMode: 'DRIVING',
    },
  },
);

// Schema for adding a stop to an existing trip
export const AddStopToTripSchema = extendApi(
  z.object({
    tripId: z.string().uuid().describe('ID of the trip to add the stop to'),
    locationData: LocationForItinerarySchema.describe('Location information for the new stop'),
    insertAtOrder: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Position to insert the stop (optional, appends to end if not specified)'),
    calculateRouting: z
      .boolean()
      .default(true)
      .describe('Whether to recalculate routing after adding the stop'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
  }),
  {
    title: 'Add Stop to Trip',
    description: 'Schema for adding a new stop to an existing trip',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      locationData: {
        name: 'Arc de Triomphe',
        description: 'Iconic triumphal arch in Paris',
        address: 'Place Charles de Gaulle',
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        postalCode: '75008',
        latitude: 48.8738,
        longitude: 2.295,
        apiSource: 'HERE',
        apiSourceId: 'here:pds:place:250jx7ps-b9d7fc1d8dbc4dd9adb39e4b7cf0b2f8',
        category: 'ATTRACTION',
        order: 1,
      },
      insertAtOrder: 1,
      calculateRouting: true,
      travelMode: 'WALKING',
    },
  },
);

// Schema for reordering stops in itinerary context
export const ItineraryReorderStopsSchema = extendApi(
  z.object({
    tripId: z.string().uuid().describe('ID of the trip containing the stops to reorder'),
    stopOrders: z
      .array(
        z.object({
          stopId: z.string().uuid().describe('ID of the stop to reorder'),
          newOrder: z.number().int().min(0).describe('New order position for the stop'),
        }),
      )
      .min(1)
      .describe('Array of stop reordering instructions (minimum 1)'),
    calculateRouting: z
      .boolean()
      .default(true)
      .describe('Whether to recalculate routing after reordering'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
  }),
  {
    title: 'Itinerary Reorder Stops',
    description: 'Schema for reordering stops within a trip itinerary',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      stopOrders: [
        {
          stopId: '550e8400-e29b-41d4-a716-446655440001',
          newOrder: 2,
        },
        {
          stopId: '550e8400-e29b-41d4-a716-446655440002',
          newOrder: 0,
        },
      ],
      calculateRouting: true,
      travelMode: 'DRIVING',
    },
  },
);

// Schema for removing a stop from a trip
export const RemoveStopFromTripSchema = extendApi(
  z.object({
    tripId: z.string().uuid().describe('ID of the trip to remove the stop from'),
    stopId: z.string().uuid().describe('ID of the stop to remove'),
    calculateRouting: z
      .boolean()
      .default(true)
      .describe('Whether to recalculate routing after removing the stop'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
  }),
  {
    title: 'Remove Stop from Trip',
    description: 'Schema for removing a stop from a trip',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      stopId: '550e8400-e29b-41d4-a716-446655440001',
      calculateRouting: true,
      travelMode: 'DRIVING',
    },
  },
);

// Schema for updating trip routing
export const UpdateTripRoutingSchema = extendApi(
  z.object({
    tripId: z.string().uuid().describe('ID of the trip to update routing for'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
    forceRecalculate: z
      .boolean()
      .default(false)
      .describe('Whether to force recalculation even if routing exists'),
  }),
  {
    title: 'Update Trip Routing',
    description: 'Schema for updating routing calculations for a trip',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440000',
      travelMode: 'WALKING',
      forceRecalculate: true,
    },
  },
);

// Schema for updating trip details with routing recalculation
export const UpdateTripWithRoutingSchema = extendApi(
  z.object({
    name: z.string().min(1).max(100).optional().describe('Trip name (1-100 characters)'),
    description: z.string().nullable().optional().describe('Optional trip description'),
    calculateRouting: z
      .boolean()
      .default(true)
      .describe('Whether to recalculate routing after updating trip details'),
    travelMode: TravelModeSchema.default('DRIVING').describe(
      'Travel mode for routing calculations',
    ),
    forceRecalculate: z
      .boolean()
      .default(false)
      .describe('Whether to force recalculation even if routing exists'),
  }),
  {
    title: 'Update Trip with Routing',
    description: 'Schema for updating trip details and optionally recalculating routing',
    example: {
      name: 'Updated European Adventure',
      description: 'An updated description for the trip',
      calculateRouting: true,
      travelMode: 'DRIVING',
      forceRecalculate: true,
    },
  },
);

export type UpdateTripWithRoutingRequest = z.infer<typeof UpdateTripWithRoutingSchema>;

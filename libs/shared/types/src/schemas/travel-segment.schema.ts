import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { uuidSchema } from './base.schema';
import { TravelMode } from '@prisma/client';
import { StopWithLocationSchema } from './stop.schema';

export const TravelModeSchema = z
  .nativeEnum(TravelMode)
  .describe('Travel mode between stops (DRIVING, WALKING, FLYING, etc.)');

export const TravelSegmentSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the travel segment'),
    tripId: uuidSchema.describe('ID of the trip this segment belongs to'),
    originStopId: uuidSchema.describe('ID of the origin stop'),
    destinationStopId: uuidSchema.describe('ID of the destination stop'),
    travelMode: TravelModeSchema.nullable().optional(),
    distance: z
      .number()
      .min(0, { message: 'Distance must be at least 0 meters' })
      .nullable()
      .optional()
      .describe('User-entered distance in meters'),
    duration: z
      .number()
      .int()
      .min(0, { message: 'Duration must be at least 0 minutes' })
      .nullable()
      .optional()
      .describe('User-entered duration in minutes'),
    apiCalculatedDistance: z
      .number()
      .min(0, { message: 'API calculated distance must be at least 0 meters' })
      .nullable()
      .optional()
      .describe('API-calculated distance in meters'),
    apiCalculatedDuration: z
      .number()
      .int()
      .min(0, { message: 'API calculated duration must be at least 0 minutes' })
      .nullable()
      .optional()
      .describe('API-calculated duration in minutes'),
    polyline: z.string().nullable().optional().describe('Encoded polyline for route visualization'),
    routeOptions: z
      .any()
      .nullable()
      .optional()
      .describe('Additional routing options (provider-specific)'),
    notes: z
      .string()
      .max(1000, { message: 'Notes cannot exceed 1000 characters' })
      .nullable()
      .optional()
      .describe('User notes about this travel segment (max 1000 chars)'),
    createdAt: z.coerce.date().describe('Timestamp when segment was created'),
    updatedAt: z.coerce.date().describe('Timestamp when segment was last updated'),
  }),
  {
    title: 'Travel Segment',
    description: 'A travel segment connecting two stops in a trip',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      originStopId: '550e8400-e29b-41d4-a716-446655440002',
      destinationStopId: '550e8400-e29b-41d4-a716-446655440003',
      travelMode: 'DRIVING',
      distance: 15000,
      duration: 20,
      apiCalculatedDistance: 14800,
      apiCalculatedDuration: 18,
      polyline: 'encoded_polyline_string',
      routeOptions: {},
      notes: 'Scenic route through the countryside',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const CreateTravelSegmentSchema = extendApi(
  TravelSegmentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }),
  {
    title: 'Create Travel Segment',
    description: 'Schema for creating a new travel segment',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      originStopId: '550e8400-e29b-41d4-a716-446655440002',
      destinationStopId: '550e8400-e29b-41d4-a716-446655440003',
      travelMode: 'DRIVING',
      notes: 'Scenic route through the countryside',
    },
  },
);

export const UpdateTravelSegmentSchema = extendApi(
  TravelSegmentSchema.pick({
    travelMode: true,
    distance: true,
    duration: true,
    apiCalculatedDistance: true,
    apiCalculatedDuration: true,
    polyline: true,
    routeOptions: true,
    notes: true,
  }).partial(),
  {
    title: 'Update Travel Segment',
    description: 'Schema for updating travel segment details (all fields optional)',
    example: {
      travelMode: 'WALKING',
      distance: 1200,
      duration: 15,
      notes: 'Updated notes about the route',
    },
  },
);

export const UpdateTravelApiCalculatedDataSchema = extendApi(
  z
    .object({
      id: uuidSchema.describe('ID of the travel segment to update'),
      apiCalculatedDistance: z
        .number()
        .min(0, { message: 'API calculated distance must be at least 0 meters' })
        .describe('API-calculated distance in meters'),
      apiCalculatedDuration: z
        .number()
        .int()
        .min(0, { message: 'API calculated duration must be at least 0 minutes' })
        .describe('API-calculated duration in minutes'),
      polyline: z.string().describe('Encoded polyline for route visualization'),
    })
    .required(),
  {
    title: 'Update Travel API Calculated Data',
    description: 'Schema for updating API-calculated travel data',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      apiCalculatedDistance: 14800,
      apiCalculatedDuration: 18,
      polyline: 'encoded_polyline_string',
    },
  },
);

export const UpdateTravelSegmentNotesSchema = extendApi(TravelSegmentSchema.pick({ notes: true }), {
  title: 'Update Travel Segment Notes',
  description: 'Schema for updating only the notes of a travel segment',
  example: {
    notes: 'Updated route notes',
  },
});

export const TravelSegmentSearchSchema = extendApi(
  TravelSegmentSchema.pick({
    tripId: true,
    originStopId: true,
    destinationStopId: true,
    travelMode: true,
  }).partial(),
  {
    title: 'Travel Segment Search',
    description: 'Search and filter parameters for travel segment queries',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      travelMode: 'DRIVING',
    },
  },
);

export const BulkTravelSegmentUpdateSchema = extendApi(
  z.object({
    tripId: uuidSchema.describe('ID of the trip containing the segments to update'),
    updates: z
      .array(
        TravelSegmentSchema.pick({
          id: true,
          travelMode: true,
          distance: true,
          duration: true,
          apiCalculatedDistance: true,
          apiCalculatedDuration: true,
          polyline: true,
          routeOptions: true,
          notes: true,
        })
          .partial()
          .refine(data => !!data.id, { message: 'id is required for each update' }),
      )
      .min(1, { message: 'At least one update is required' })
      .describe('Array of travel segment updates to apply'),
  }),
  {
    title: 'Bulk Travel Segment Update',
    description: 'Schema for updating multiple travel segments in a single operation',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      updates: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          travelMode: 'WALKING',
          distance: 1200,
          notes: 'Changed to walking route',
        },
      ],
    },
  },
);

export const UpdateTravelSegmentRoutingDataSchema = extendApi(
  z.object({
    travelMode: TravelModeSchema,
    distanceMeters: z
      .number()
      .min(0, { message: 'Distance must be at least 0 meters' })
      .describe('Distance in meters'),
    durationSeconds: z
      .number()
      .min(0, { message: 'Duration must be at least 0 seconds' })
      .describe('Duration in seconds'),
    polyline: z.string().optional().describe('Encoded polyline for route visualization'),
    provider: z
      .enum(['HERE', 'MAPBOX'], { message: 'Provider must be either HERE or MAPBOX' })
      .describe('Routing API provider'),
  }),
  {
    title: 'Update Travel Segment Routing Data',
    description: 'Schema for updating routing data from external APIs',
    example: {
      travelMode: 'DRIVING',
      distanceMeters: 14800,
      durationSeconds: 1080,
      polyline: 'encoded_polyline_string',
      provider: 'HERE',
    },
  },
);

export const TravelSegmentWithStopsSchema = extendApi(
  TravelSegmentSchema.extend({
    originStop: StopWithLocationSchema.describe('Complete origin stop information'),
    destinationStop: StopWithLocationSchema.describe('Complete destination stop information'),
  }),
  {
    title: 'Travel Segment with Stops',
    description: 'Travel segment with complete origin and destination stop details',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      originStopId: '550e8400-e29b-41d4-a716-446655440002',
      destinationStopId: '550e8400-e29b-41d4-a716-446655440003',
      travelMode: 'DRIVING',
      distance: 15000,
      duration: 20,
      notes: 'Scenic route',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      originStop: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        tripId: '550e8400-e29b-41d4-a716-446655440001',
        locationId: '550e8400-e29b-41d4-a716-446655440004',
        order: 0,
        location: {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Paris',
        },
      },
      destinationStop: {
        id: '550e8400-e29b-41d4-a716-446655440003',
        tripId: '550e8400-e29b-41d4-a716-446655440001',
        locationId: '550e8400-e29b-41d4-a716-446655440005',
        order: 1,
        location: {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Berlin',
        },
      },
    },
  },
);

// Types
export type TravelSegment = z.infer<typeof TravelSegmentSchema>;
export type TravelSegmentWithStops = z.infer<typeof TravelSegmentWithStopsSchema>;
export type CreateTravelSegmentRequest = z.infer<typeof CreateTravelSegmentSchema>;
export type UpdateTravelSegmentRequest = z.infer<typeof UpdateTravelSegmentSchema>;
export type UpdateTravelSegmentNotesRequest = z.infer<typeof UpdateTravelSegmentNotesSchema>;
export type TravelSegmentSearchCriteria = z.infer<typeof TravelSegmentSearchSchema>;
export type BulkTravelSegmentUpdateRequest = z.infer<typeof BulkTravelSegmentUpdateSchema>;
export type UpdateTravelSegmentRoutingData = z.infer<typeof UpdateTravelSegmentRoutingDataSchema>;
export type UpdateTravelApiCalculatedData = z.infer<typeof UpdateTravelApiCalculatedDataSchema>;

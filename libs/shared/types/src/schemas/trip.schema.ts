import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { StopSchema } from './stop.schema';
import { TravelSegmentSchema } from './travel-segment.schema';
import { TripBankedLocationSchema } from './trip-banked-location.schema';
import { uuidSchema } from './base.schema';

export const TripSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the trip'),
    userId: uuidSchema.describe('ID of the user who owns this trip'),
    name: z.string().min(1).max(100).describe('Trip name (1-100 characters)'),
    description: z.string().nullable().optional().describe('Optional trip description'),
    startDate: z.coerce.date().nullable().optional().describe('Planned start date of the trip'),
    endDate: z.coerce.date().nullable().optional().describe('Planned end date of the trip'),
    matrix: z
      .any()
      .nullable()
      .optional()
      .describe('Optional matrix for trip planning (e.g. JSON string)'),
    // Zod v3 does not support .json(), so for now we use any type

    createdAt: z.coerce.date().describe('Timestamp when trip was created'),
    updatedAt: z.coerce.date().describe('Timestamp when trip was last updated'),

    // Relations (optional for some use cases)
    stops: z.array(StopSchema).optional().default([]).describe('Ordered list of stops in the trip'),
    bankedLocations: z
      .array(TripBankedLocationSchema)
      .optional()
      .default([])
      .describe('Saved locations for this trip'),
    travelSegments: z
      .array(TravelSegmentSchema)
      .optional()
      .default([])
      .describe('Travel segments between stops'),
  }),
  {
    title: 'Trip',
    description: 'A travel trip with stops, locations, and itinerary',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'European Adventure',
      description: 'A two-week trip through Europe',
      startDate: '2024-06-01T00:00:00Z',
      endDate: '2024-06-15T00:00:00Z',
      matrix: '{"some":"matrix data"}',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      stops: [],
      bankedLocations: [],
      travelSegments: [],
    },
  },
);

export const CreateTripRequestSchema = extendApi(
  TripSchema.pick({
    name: true,
    description: true,
    startDate: true,
    endDate: true,
    matrix: true,
  }),
  {
    title: 'Create Trip Request',
    description: 'Schema for creating a new trip',
    example: {
      name: 'European Adventure',
      description: 'A two-week trip through Europe',
      startDate: '2024-06-01T00:00:00Z',
      endDate: '2024-06-15T00:00:00Z',
      matrix: '{"some":"matrix data"}',
    },
  },
);

export const UpdateTripRequestSchema = extendApi(
  TripSchema.pick({
    name: true,
    description: true,
  }).partial(),
  {
    title: 'Update Trip Request',
    description: 'Schema for updating trip basic information (all fields optional)',
    example: {
      name: 'Updated European Adventure',
      description: 'An updated description for the trip',
    },
  },
);

export const TripServiceUpdateRequestSchema = extendApi(
  TripSchema.pick({
    name: true,
    description: true,
    startDate: true,
    endDate: true,
  }).partial(),
  {
    title: 'Trip Service Update Request',
    description: 'Schema for service-level trip updates including dates (all fields optional)',
    example: {
      name: 'Updated European Adventure',
      description: 'An updated description for the trip',
      startDate: '2024-07-01T00:00:00Z',
      endDate: '2024-07-15T00:00:00Z',
    },
  },
);

export const TripSearchCriteriaSchema = extendApi(
  z.object({
    userId: uuidSchema.optional().describe('Filter trips by user ID'),
    name: z.string().optional().describe('Filter trips by name (partial match)'),
    includeStops: z.boolean().optional().default(false).describe('Include stops in the response'),
    includeBankedLocations: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include banked locations in the response'),
    includeTravelSegments: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include travel segments in the response'),
  }),
  {
    title: 'Trip Search Criteria',
    description: 'Search and filter parameters for trip queries',
    example: {
      userId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Europe',
      includeStops: true,
      includeBankedLocations: false,
      includeTravelSegments: false,
      includeMatrix: false,
    },
  },
);

export type Trip = z.infer<typeof TripSchema>;
export type CreateTripRequest = z.infer<typeof CreateTripRequestSchema>;
export type UpdateTripRequest = z.infer<typeof UpdateTripRequestSchema>;
export type TripServiceUpdateRequest = z.infer<typeof TripServiceUpdateRequestSchema>;
export type TripSearchCriteria = z.infer<typeof TripSearchCriteriaSchema>;

import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { LocationSchema } from './location.schema';
import { uuidSchema } from './base.schema';
import { StopType } from '@prisma/client';

export const StopTypeSchema = z
  .nativeEnum(StopType)
  .describe('Type of stop (PITSTOP or OVERNIGHT)');

export const StopSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the stop'),
    tripId: uuidSchema.describe('ID of the trip this stop belongs to'),
    locationId: uuidSchema.describe('ID of the location for this stop'),
    order: z.number().int().min(0).describe('Order position of stop in the trip (0-indexed)'),

    // Timing fields
    plannedArrivalTime: z.coerce.date().nullable().optional().describe('User-planned arrival time'),
    plannedDuration: z
      .number()
      .int()
      .nullable()
      .optional()
      .describe('Planned duration in seconds at this stop'),
    calculatedArrivalTime: z.coerce
      .date()
      .nullable()
      .optional()
      .describe('System-calculated arrival time'),
    calculatedDepartureTime: z.coerce
      .date()
      .nullable()
      .optional()
      .describe('System-calculated departure time'),

    stopType: StopTypeSchema.nullable().optional(),
    notes: z.string().nullable().optional().describe('User notes about this stop'),

    createdAt: z.coerce.date().describe('Timestamp when stop was created'),
    updatedAt: z.coerce.date().describe('Timestamp when stop was last updated'),

    // Relations
    location: LocationSchema.optional().describe('Location details for this stop'),
  }),
  {
    title: 'Stop',
    description: 'A stop in a trip itinerary with timing and location details',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      locationId: '550e8400-e29b-41d4-a716-446655440002',
      order: 0,
      plannedArrivalTime: '2024-06-01T10:00:00Z',
      plannedDuration: 120,
      calculatedArrivalTime: '2024-06-01T10:00:00Z',
      calculatedDepartureTime: '2024-06-01T12:00:00Z',
      stopType: 'PITSTOP',
      notes: 'Visit the famous cathedral',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const CreateStopSchema = extendApi(
  StopSchema.pick({
    tripId: true,
    locationId: true,
    order: true,
    plannedArrivalTime: true,
    plannedDuration: true,
    stopType: true,
    notes: true,
  }),
  {
    title: 'Create Stop',
    description: 'Schema for creating a new stop in a trip',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      locationId: '550e8400-e29b-41d4-a716-446655440002',
      order: 0,
      plannedArrivalTime: '2024-06-01T10:00:00Z',
      plannedDuration: 120,
      stopType: 'PITSTOP',
      notes: 'Visit the famous cathedral',
    },
  },
);

export const UpdateStopSchema = extendApi(
  StopSchema.pick({
    plannedArrivalTime: true,
    plannedDuration: true,
    stopType: true,
    notes: true,
  }).partial(),
  {
    title: 'Update Stop',
    description: 'Schema for updating stop details (all fields optional)',
    example: {
      plannedArrivalTime: '2024-06-01T11:00:00Z',
      plannedDuration: 180,
      notes: 'Updated notes about the stop',
    },
  },
);

export const StopWithLocationSchema = extendApi(
  StopSchema.extend({
    location: LocationSchema.describe('Complete location information for this stop'),
  }),
  {
    title: 'Stop with Location',
    description: 'Stop with complete location details included',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      locationId: '550e8400-e29b-41d4-a716-446655440002',
      order: 0,
      plannedArrivalTime: '2024-06-01T10:00:00Z',
      plannedDuration: 120,
      stopType: 'PITSTOP',
      notes: 'Visit the famous cathedral',
      extendedData: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      location: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Notre Dame Cathedral',
        latitude: 48.8529,
        longitude: 2.3499,
      },
    },
  },
);

export const ReorderStopsSchema = extendApi(
  z.object({
    tripId: uuidSchema.describe('ID of the trip containing the stops to reorder'),
    stopIds: z.array(uuidSchema).describe('Array of stop IDs in new order'),
  }),
  {
    title: 'Reorder Stops',
    description: 'Schema for reordering stops in a trip',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      stopIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440003'],
    },
  },
);

export const StopOrderUpdateSchema = extendApi(
  StopSchema.pick({
    id: true,
    order: true,
  }),
  {
    title: 'Stop Order Update',
    description: 'Schema for updating a single stop order position',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      order: 2,
    },
  },
);

export const BulkStopUpdateSchema = extendApi(
  z.object({
    tripId: uuidSchema.describe('ID of the trip containing the stops to update'),
    updates: z
      .array(
        z.object({
          id: uuidSchema.describe('ID of the stop to update'),
          plannedArrivalTime: z.coerce
            .date()
            .nullable()
            .optional()
            .describe('Updated planned arrival time'),
          plannedDuration: z
            .number()
            .int()
            .min(0)
            .nullable()
            .optional()
            .describe('Updated planned duration in minutes'),
          stopType: StopTypeSchema.nullable().optional(),
          notes: z.string().nullable().optional().describe('Updated notes for the stop'),
        }),
      )
      .describe('Array of stop updates to apply'),
  }),
  {
    title: 'Bulk Stop Update',
    description: 'Schema for updating multiple stops in a single operation',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      updates: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          plannedArrivalTime: '2024-06-01T10:30:00Z',
          plannedDuration: 150,
          notes: 'Updated visit notes',
        },
      ],
    },
  },
);

export const StopSearchSchema = extendApi(
  z.object({
    tripId: uuidSchema.optional().describe('Filter stops by trip ID'),
    includeLocation: z
      .boolean()
      .default(false)
      .optional()
      .describe('Include location details in response'),
    locationId: uuidSchema.optional().describe('Filter stops by location ID'),
    stopType: StopTypeSchema.optional().describe('Filter stops by type'),
  }),
  {
    title: 'Stop Search',
    description: 'Search and filter parameters for stop queries',
    example: {
      tripId: '550e8400-e29b-41d4-a716-446655440001',
      includeLocation: true,
      stopType: 'PITSTOP',
    },
  },
);

export type Stop = z.infer<typeof StopSchema>;
export type CreateStopRequest = z.infer<typeof CreateStopSchema>;
export type UpdateStopRequest = z.infer<typeof UpdateStopSchema>;
export type StopWithLocation = z.infer<typeof StopWithLocationSchema>;
export type ReorderStopsRequest = z.infer<typeof ReorderStopsSchema>;
export type StopOrderUpdate = z.infer<typeof StopOrderUpdateSchema>;
export type BulkStopUpdateRequest = z.infer<typeof BulkStopUpdateSchema>;
export type StopSearchCriteria = z.infer<typeof StopSearchSchema>;

import { z } from 'zod';
import { LocationSchema } from './location.schema';
import { uuidSchema } from './base.schema';
import { StopType } from '@prisma/client';

export const StopTypeSchema = z.nativeEnum(StopType);

export const StopSchema = z.object({
  id: uuidSchema,
  tripId: uuidSchema,
  locationId: uuidSchema,
  order: z.number().int().min(0),

  // Timing fields
  plannedArrivalTime: z.coerce.date().nullable().optional(),
  plannedDuration: z.number().int().nullable().optional(), // minutes - user controlled
  calculatedArrivalTime: z.coerce.date().nullable().optional(),
  calculatedDepartureTime: z.coerce.date().nullable().optional(),

  stopType: StopTypeSchema.nullable().optional(), // PITSTOP or OVERNIGHT
  notes: z.string().nullable().optional(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  // Relations
  location: LocationSchema.optional(),
});

export const CreateStopSchema = StopSchema.pick({
  tripId: true,
  locationId: true,
  order: true,
  plannedArrivalTime: true,
  plannedDuration: true,
  stopType: true,
  notes: true,
});

export const UpdateStopSchema = StopSchema.pick({
  plannedArrivalTime: true,
  plannedDuration: true,
  stopType: true,
  notes: true,
}).partial();

export const StopWithLocationSchema = StopSchema.extend({
  location: LocationSchema,
});

export const ReorderStopsSchema = z.object({
  tripId: uuidSchema,
  stopIds: z.array(uuidSchema), // Array of stop IDs in new order
});

export const StopOrderUpdateSchema = StopSchema.pick({
  id: true,
  order: true,
});

export const BulkStopUpdateSchema = z.object({
  tripId: uuidSchema,
  updates: z.array(
    z.object({
      id: uuidSchema,
      plannedArrivalTime: z.coerce.date().nullable().optional(),
      plannedDuration: z.number().int().min(0).nullable().optional(),
      stopType: StopTypeSchema.nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  ),
});

export const StopSearchSchema = z.object({
  tripId: uuidSchema.optional(),
  includeLocation: z.boolean().default(false).optional(),
  locationId: uuidSchema.optional(),
  stopType: StopTypeSchema.optional(),
});

export type Stop = z.infer<typeof StopSchema>;
export type CreateStopRequest = z.infer<typeof CreateStopSchema>;
export type UpdateStopRequest = z.infer<typeof UpdateStopSchema>;
export type StopWithLocation = z.infer<typeof StopWithLocationSchema>;
export type ReorderStopsRequest = z.infer<typeof ReorderStopsSchema>;
export type StopOrderUpdate = z.infer<typeof StopOrderUpdateSchema>;
export type BulkStopUpdateRequest = z.infer<typeof BulkStopUpdateSchema>;
export type StopSearchCriteria = z.infer<typeof StopSearchSchema>;

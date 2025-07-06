import { z } from 'zod';
import { LocationCategorySchema } from './location.schema';
import { TravelModeSchema } from './travel-segment.schema';

export const OrganizedLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string(),
  address: z.string().optional(),
  category: LocationCategorySchema.nullable().optional(),
  order: z.number().int().min(0),
});

// Schema for creating a trip from organized locations
export const CreateTripFromOrganizedListSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  organizedLocations: z.array(OrganizedLocationSchema).min(1),
  calculateRouting: z.boolean().default(true),
  travelMode: TravelModeSchema.default('DRIVING'),
});

// Schema for adding a stop to an existing trip
export const AddStopToTripSchema = z.object({
  tripId: z.string().uuid(),
  locationData: OrganizedLocationSchema,
  insertAtOrder: z.number().int().min(0).optional(),
  calculateRouting: z.boolean().default(true),
  travelMode: TravelModeSchema.default('DRIVING'),
});

// Schema for reordering stops in itinerary context
export const ItineraryReorderStopsSchema = z.object({
  tripId: z.string().uuid(),
  stopOrders: z
    .array(
      z.object({
        stopId: z.string().uuid(),
        newOrder: z.number().int().min(0),
      }),
    )
    .min(1),
  calculateRouting: z.boolean().default(true),
  travelMode: TravelModeSchema.default('DRIVING'),
});

// Schema for removing a stop from a trip
export const RemoveStopFromTripSchema = z.object({
  tripId: z.string().uuid(),
  stopId: z.string().uuid(),
  calculateRouting: z.boolean().default(true),
  travelMode: TravelModeSchema.default('DRIVING'),
});

// Schema for updating trip routing
export const UpdateTripRoutingSchema = z.object({
  tripId: z.string().uuid(),
  travelMode: TravelModeSchema.default('DRIVING'),
  forceRecalculate: z.boolean().default(false),
});

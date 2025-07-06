import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './base.schema';
import { TravelMode } from '@prisma/client';
import { TravelModeSchema } from './travel-segment.schema';

export const WaypointSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  name: z.string().optional(),
});

export const RouteLegSchema = z.object({
  distance: z.number().min(0),
  duration: z.number().min(0),
  startWaypoint: WaypointSchema,
  endWaypoint: WaypointSchema,
  geometry: z.string(), // Polyline/geometry for this specific leg
});

export const RouteSchema = z.object({
  distance: z.number().min(0),
  duration: z.number().min(0),
  geometry: z.string(),
  legs: z.array(RouteLegSchema),
  waypointOrder: z.array(z.number()).optional(),
});

export const RouteOptionsSchema = z.object({
  travelMode: TravelModeSchema.optional().default(TravelMode.DRIVING),
  timeAware: z.boolean().optional().default(false),
  departureTime: z.coerce.date().optional(),
  avoidTolls: z.boolean().optional().default(false),
  avoidHighways: z.boolean().optional().default(false),
  avoidFerries: z.boolean().optional().default(false),
});

export const RoutingRequestSchema = z.object({
  waypoints: z.array(WaypointSchema).min(2).max(100),
  options: RouteOptionsSchema.optional(),
});

export const RoutingResponseSchema = z.object({
  route: RouteSchema,
  provider: z.enum(['HERE', 'MAPBOX']),
  waypointCount: z.number(),
  requestedAt: z.coerce.date(),
  rawResponse: z.any().optional(),
});

export type Waypoint = z.infer<typeof WaypointSchema>;
export type RouteLeg = z.infer<typeof RouteLegSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type RouteOptions = z.infer<typeof RouteOptionsSchema>;
export type RoutingRequest = z.infer<typeof RoutingRequestSchema>;
export type RoutingResponse = z.infer<typeof RoutingResponseSchema>;
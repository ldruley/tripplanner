import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { latitudeSchema, longitudeSchema } from './base.schema';
import { TravelMode } from '@prisma/client';
import { TravelModeSchema } from './travel-segment.schema';

export const WaypointSchema = extendApi(
  z.object({
    latitude: latitudeSchema.describe('Latitude of the waypoint'),
    longitude: longitudeSchema.describe('Longitude of the waypoint'),
    name: z.string().optional().describe('Optional name for the waypoint'),
  }),
  {
    title: 'Waypoint',
    description: 'A point along a route with coordinates and optional name',
    example: {
      latitude: 48.8566,
      longitude: 2.3522,
      name: 'Eiffel Tower',
    },
  },
);

export const RouteLegSchema = extendApi(
  z.object({
    distance: z.number().min(0).describe('Distance of this leg in meters'),
    duration: z.number().min(0).describe('Duration of this leg in seconds'),
    startWaypoint: WaypointSchema.describe('Starting waypoint of this leg'),
    endWaypoint: WaypointSchema.describe('Ending waypoint of this leg'),
    geometry: z.string().describe('Polyline/geometry for this specific leg'),
  }),
  {
    title: 'Route Leg',
    description: 'A segment of a route between two waypoints',
    example: {
      distance: 5000,
      duration: 600,
      startWaypoint: {
        latitude: 48.8566,
        longitude: 2.3522,
        name: 'Start Point',
      },
      endWaypoint: {
        latitude: 48.8606,
        longitude: 2.3376,
        name: 'End Point',
      },
      geometry: 'encoded_polyline_string',
    },
  },
);

export const RouteSchema = extendApi(
  z.object({
    distance: z.number().min(0).describe('Total distance of the route in meters'),
    duration: z.number().min(0).describe('Total duration of the route in seconds'),
    geometry: z.string().describe('Complete polyline/geometry for the entire route'),
    legs: z.array(RouteLegSchema).describe('Individual legs that make up the route'),
    waypointOrder: z.array(z.number()).optional().describe('Optimized waypoint order if route optimization was requested'),
  }),
  {
    title: 'Route',
    description: 'Complete route information with legs and geometry',
    example: {
      distance: 15000,
      duration: 1800,
      geometry: 'complete_encoded_polyline_string',
      legs: [],
      waypointOrder: [0, 2, 1, 3],
    },
  },
);

export const RouteOptionsSchema = extendApi(
  z.object({
    travelMode: TravelModeSchema.optional().default(TravelMode.DRIVING).describe('Travel mode for routing (defaults to DRIVING)'),
    timeAware: z.boolean().optional().default(false).describe('Whether to consider traffic and time-based routing'),
    departureTime: z.coerce.date().optional().describe('Departure time for time-aware routing'),
    avoidTolls: z.boolean().optional().default(false).describe('Avoid toll roads'),
    avoidHighways: z.boolean().optional().default(false).describe('Avoid highways'),
    avoidFerries: z.boolean().optional().default(false).describe('Avoid ferries'),
  }),
  {
    title: 'Route Options',
    description: 'Configuration options for route calculation',
    example: {
      travelMode: 'DRIVING',
      timeAware: true,
      departureTime: '2024-06-01T10:00:00Z',
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: true,
    },
  },
);

export const RoutingRequestSchema = extendApi(
  z.object({
    waypoints: z.array(WaypointSchema).min(2).max(100).describe('Array of waypoints (minimum 2, maximum 100)'),
    options: RouteOptionsSchema.optional().describe('Optional routing configuration'),
  }),
  {
    title: 'Routing Request',
    description: 'Request schema for calculating routes between waypoints',
    example: {
      waypoints: [
        {
          latitude: 48.8566,
          longitude: 2.3522,
          name: 'Paris',
        },
        {
          latitude: 51.5074,
          longitude: -0.1278,
          name: 'London',
        },
      ],
      options: {
        travelMode: 'DRIVING',
        avoidTolls: false,
      },
    },
  },
);

export const RoutingResponseSchema = extendApi(
  z.object({
    route: RouteSchema.describe('Calculated route information'),
    provider: z.enum(['HERE', 'MAPBOX']).describe('Routing service provider that calculated the route'),
    waypointCount: z.number().describe('Number of waypoints in the original request'),
    requestedAt: z.coerce.date().describe('Timestamp when the route was calculated'),
    rawResponse: z.any().optional().describe('Raw response from the routing provider (optional)'),
  }),
  {
    title: 'Routing Response',
    description: 'Response schema for routing calculations',
    example: {
      route: {
        distance: 460000,
        duration: 18000,
        geometry: 'encoded_polyline_string',
        legs: [],
      },
      provider: 'HERE',
      waypointCount: 2,
      requestedAt: '2024-01-01T10:00:00Z',
      rawResponse: {},
    },
  },
);

export type Waypoint = z.infer<typeof WaypointSchema>;
export type RouteLeg = z.infer<typeof RouteLegSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type RouteOptions = z.infer<typeof RouteOptionsSchema>;
export type RoutingRequest = z.infer<typeof RoutingRequestSchema>;
export type RoutingResponse = z.infer<typeof RoutingResponseSchema>;
import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { coordinatesArraySchema, coordinateSchema } from './base.schema';

export const MatrixCellSchema = extendApi(
  z.object({
    time: z.number().describe('Travel time in seconds'),
    distance: z.number().describe('Travel distance in meters'),
  }),
  {
    title: 'Matrix Cell',
    description: 'A cell in the matrix representing time and distance between two coordinates',
    example: {
      time: 1800,
      distance: 25000,
    },
  },
);

export type MatrixCell = z.infer<typeof MatrixCellSchema>;

export const CoordinateMatrixSchema: z.ZodType<Record<string, Record<string, MatrixCell>>> = extendApi(
  z.record(z.record(MatrixCellSchema)),
  {
    title: 'Coordinate Matrix',
    description: 'A matrix of coordinates, mapping origin keys to destination keys and their MatrixCell values',
    example: {
      '48.8566,2.3522': {
        '51.5074,-0.1278': {
          time: 12600,
          distance: 460000,
        },
      },
    },
  },
);

export type CoordinateMatrix = z.infer<typeof CoordinateMatrixSchema>;

export function toCoordinateKey(coord: { lat: number; lng: number }): string {
  // Round to 5 decimal places to ensure consistent string representation
  const lat = coord.lat.toFixed(5);
  const lng = coord.lng.toFixed(5);
  return `${lat},${lng}`;
}

export function toReverseCoordinateKey(coord: { lat: number; lng: number }): string {
  return `${coord.lng},${coord.lat}`;
}

const coordinateFromJsonString = z
  .string()
  .describe('A JSON string representing a coordinate object')
  .transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      return coordinateSchema.parse(parsed);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid coordinate JSON string',
      });
      return z.NEVER;
    }
  });

export const MatrixQuerySchema = extendApi(
  z.object({
    origins: z
      .array(coordinateFromJsonString)
      .describe('Array of origin coordinates as JSON strings'),
    profile: z
      .enum(['carFast', 'carShort', 'pedestrian', 'bicycle'])
      .optional()
      .nullable()
      .describe('Routing profile to use (optional)'),
    routingMode: z
      .enum(['fast', 'short'])
      .optional()
      .nullable()
      .describe('Routing mode to use (optional)'),
  }),
  {
    title: 'Matrix Query',
    description: 'Query schema for requesting a matrix calculation',
    example: {
      origins: ['{"lat":48.8566,"lng":2.3522}', '{"lat":51.5074,"lng":-0.1278}'],
      profile: 'carFast',
      routingMode: 'fast',
    },
  },
);

export type MatrixQuery = z.infer<typeof MatrixQuerySchema>;
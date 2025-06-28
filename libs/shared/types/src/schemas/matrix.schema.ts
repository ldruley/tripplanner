import { z } from 'zod';
import { coordinatesArraySchema, coordinateSchema } from './base.schema';

export const MatrixCellSchema = z.object({
  time: z.number(),     // in seconds
  distance: z.number(), // in meters
});

export type MatrixCell = z.infer<typeof MatrixCellSchema>;

export const CoordinateMatrixSchema: z.ZodType<Record<string, Record<string, MatrixCell>>> =
  z.record(z.record(MatrixCellSchema));

export type CoordinateMatrix = z.infer<typeof CoordinateMatrixSchema>;


export function toCoordinateKey(coord: { lat: number; lng: number }): string {
  return `${coord.lat},${coord.lng}`;
}

const coordinateFromJsonString = z
  .string()
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

export const MatrixQuerySchema = z.object({
  origins: z.array(coordinateFromJsonString),
  profile: z.enum(['carFast', 'carShort', 'pedestrian', 'bicycle']).optional().nullable(),
  routingMode: z.enum(['fast', 'short']).optional().nullable(),
});

export type MatrixQuery = z.infer<typeof MatrixQuerySchema>;


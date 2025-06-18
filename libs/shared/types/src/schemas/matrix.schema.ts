import { z } from 'zod';
import { coordinatesArraySchema } from './base.schema';
import { createZodDto } from '@anatine/zod-nestjs';


export const MatrixQuerySchema = z.object({
  origins: coordinatesArraySchema,
  profile: z.enum(['carFast', 'carShort', 'pedestrian', 'bicycle']).optional().nullable(),
  routingMode: z.enum(['fast', 'short']).optional().nullable(),
});

export class MatrixQueryDto extends createZodDto(MatrixQuerySchema) {}

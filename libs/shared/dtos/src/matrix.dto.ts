import { createZodDto } from '@anatine/zod-nestjs';
import { CoordinateMatrixSchema, MatrixQuerySchema } from '@trip-planner/types';

export class MatrixQueryDto extends createZodDto(MatrixQuerySchema) {}
export class CoordinateMatrixDto extends createZodDto(CoordinateMatrixSchema) {}

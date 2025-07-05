import { createZodDto } from '@anatine/zod-nestjs';
import {
  BulkStopUpdateSchema,
  CreateStopSchema,
  ReorderStopsSchema,
  StopSchema,
  StopSearchSchema,
  UpdateStopSchema,
} from '@trip-planner/types';

export class StopDto extends createZodDto(StopSchema) {}
export class CreateStopDto extends createZodDto(CreateStopSchema) {}
export class UpdateStopDto extends createZodDto(UpdateStopSchema) {}
export class ReorderStopsDto extends createZodDto(ReorderStopsSchema) {}
export class BulkStopUpdateDto extends createZodDto(BulkStopUpdateSchema) {}
export class StopSearchDto extends createZodDto(StopSearchSchema) {}

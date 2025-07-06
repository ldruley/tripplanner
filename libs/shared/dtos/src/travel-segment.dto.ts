import { createZodDto } from '@anatine/zod-nestjs';
import {
  BulkTravelSegmentUpdateSchema,
  CreateTravelSegmentSchema,
  TravelSegmentSchema,
  TravelSegmentSearchSchema,
  UpdateTravelSegmentSchema,
  UpdateTravelSegmentNotesSchema,
} from '@trip-planner/types';

export class TravelSegmentDto extends createZodDto(TravelSegmentSchema) {}
export class CreateTravelSegmentDto extends createZodDto(CreateTravelSegmentSchema) {}
export class UpdateTravelSegmentDto extends createZodDto(UpdateTravelSegmentSchema) {}
export class UpdateTravelSegmentNotesDto extends createZodDto(UpdateTravelSegmentNotesSchema) {}
export class BulkTravelSegmentUpdateDto extends createZodDto(BulkTravelSegmentUpdateSchema) {}
export class TravelSegmentSearchDto extends createZodDto(TravelSegmentSearchSchema) {}
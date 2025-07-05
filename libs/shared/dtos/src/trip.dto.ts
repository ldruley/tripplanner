import { createZodDto } from '@anatine/zod-nestjs';
import { 
  TripSchema, 
  CreateTripRequestSchema, 
  UpdateTripRequestSchema,
  TripSearchCriteriaSchema 
} from '../../types/src/schemas/trip.schema';

export class TripDto extends createZodDto(TripSchema) {}

export class CreateTripDto extends createZodDto(CreateTripRequestSchema) {}

export class UpdateTripDto extends createZodDto(UpdateTripRequestSchema) {}

export class TripSearchDto extends createZodDto(TripSearchCriteriaSchema) {}

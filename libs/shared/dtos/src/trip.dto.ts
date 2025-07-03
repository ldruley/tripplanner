import { createZodDto } from '@anatine/zod-nestjs';
import { TripSchema } from '../../types/src/schemas/trip.schema';

export class TripDto extends createZodDto(TripSchema) {}

import { createZodDto} from '@anatine/zod-nestjs';
import { TripSchema } from '../schemas/trip.schema';

export class TripDto extends createZodDto(TripSchema) {}

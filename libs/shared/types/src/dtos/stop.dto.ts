import { createZodDto} from '@anatine/zod-nestjs';
import { StopSchema } from '../schemas/stop.schema';

export class StopDto extends createZodDto(StopSchema) {}

import { createZodDto} from '@anatine/zod-nestjs';
import { StopSchema } from 'libs/shared/types/src/schemas/stop.schema';

export class StopDto extends createZodDto(StopSchema) {}

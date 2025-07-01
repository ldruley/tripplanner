import { createZodDto} from '@anatine/zod-nestjs';
import { StopSchema } from '@trip-planner/types';

export class StopDto extends createZodDto(StopSchema) {}

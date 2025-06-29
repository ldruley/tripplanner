import { createZodDto } from '@anatine/zod-nestjs';
import { TimezoneRequestSchema, TimezoneResponseSchema } from '@trip-planner/types';


export class TimezoneRequestDto extends createZodDto(TimezoneRequestSchema) {}
export class TimezoneResponseDto extends createZodDto(TimezoneResponseSchema) {}

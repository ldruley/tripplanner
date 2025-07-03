import { createZodDto } from '@anatine/zod-nestjs';

import { LocationSchema } from '../../types/src/schemas/location.schema';

export class LocationDto extends createZodDto(LocationSchema) {}

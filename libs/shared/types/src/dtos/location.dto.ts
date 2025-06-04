import { createZodDto} from '@anatine/zod-nestjs';

import { LocationSchema } from '../schemas/location.schema';

export class LocationDto extends createZodDto(LocationSchema) {}

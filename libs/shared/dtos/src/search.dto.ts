import { createZodDto } from '@anatine/zod-nestjs';
import { PoiSearchQuerySchema, PoiSearchResultSchema } from '@trip-planner/types';

export class PoiSearchQueryDto extends createZodDto(PoiSearchQuerySchema) {}
export class PoiSearchResultDto extends createZodDto(PoiSearchResultSchema) {}

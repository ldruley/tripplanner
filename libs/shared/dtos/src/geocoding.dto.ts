import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';
import {
  ForwardGeocodeQuerySchema,
  GeocodingResultSchema,
  ReverseGeocodeQuerySchema,
} from '@trip-planner/types';

export class ForwardGeocodeQueryDto extends createZodDto(ForwardGeocodeQuerySchema) {};
export class ReverseGeocodeQueryDto extends createZodDto(ReverseGeocodeQuerySchema) {};
export class GeocodingResultDto extends createZodDto(GeocodingResultSchema) {}

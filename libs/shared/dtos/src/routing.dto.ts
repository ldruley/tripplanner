import { createZodDto } from '@anatine/zod-nestjs';
import {
  RoutingRequestSchema,
  RouteOptionsSchema,
  WaypointSchema,
  RoutingResponseSchema,
} from '../../types/src/schemas/routing.schema';

export class RoutingRequestDto extends createZodDto(RoutingRequestSchema) {}
export class RoutingResponseDto extends createZodDto(RoutingResponseSchema) {}

export class RouteOptionsDto extends createZodDto(RouteOptionsSchema) {}

export class WaypointDto extends createZodDto(WaypointSchema) {}

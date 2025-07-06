import { createZodDto } from '@anatine/zod-nestjs';
import { 
  RoutingRequestSchema,
  RouteOptionsSchema,
  WaypointSchema,
} from '../../types/src/schemas/routing.schema';

export class RoutingRequestDto extends createZodDto(RoutingRequestSchema) {}

export class RouteOptionsDto extends createZodDto(RouteOptionsSchema) {}

export class WaypointDto extends createZodDto(WaypointSchema) {}
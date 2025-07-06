import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
import { TravelModeSchema, LocationCategorySchema } from '@trip-planner/types';
import {
  AddStopToTripSchema,
  CreateTripFromOrganizedListSchema,
  ItineraryReorderStopsSchema,
  OrganizedLocationSchema,
  RemoveStopFromTripSchema,
  UpdateTripRoutingSchema,
} from '../../types/src/schemas/itinerary.schema';

// Schema for organized location data from frontend

// DTOs
export class OrganizedLocationDto extends createZodDto(OrganizedLocationSchema) {}

export class CreateTripFromOrganizedListDto extends createZodDto(
  CreateTripFromOrganizedListSchema,
) {}

export class AddStopToTripDto extends createZodDto(AddStopToTripSchema) {}

export class ItineraryReorderStopsDto extends createZodDto(ItineraryReorderStopsSchema) {}

export class RemoveStopFromTripDto extends createZodDto(RemoveStopFromTripSchema) {}

export class UpdateTripRoutingDto extends createZodDto(UpdateTripRoutingSchema) {}

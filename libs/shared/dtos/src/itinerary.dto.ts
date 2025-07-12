import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';
import {
  TravelModeSchema,
  LocationCategorySchema,
  LocationForItinerarySchema,
} from '@trip-planner/types';
import {
  AddStopToTripSchema,
  CreateTripFromOrderedListSchema,
  ItineraryReorderStopsSchema,
  RemoveStopFromTripSchema,
  UpdateTripRoutingSchema,
  UpdateTripWithRoutingSchema,
} from '../../types/src/schemas/itinerary.schema';

// Schema for location data from frontend with itinerary ordering

// DTOs
export class LocationForItineraryDto extends createZodDto(LocationForItinerarySchema) {}

export class CreateTripFromOrderedListDto extends createZodDto(CreateTripFromOrderedListSchema) {}

export class AddStopToTripDto extends createZodDto(AddStopToTripSchema) {}

export class ItineraryReorderStopsDto extends createZodDto(ItineraryReorderStopsSchema) {}

export class RemoveStopFromTripDto extends createZodDto(RemoveStopFromTripSchema) {}

export class UpdateTripRoutingDto extends createZodDto(UpdateTripRoutingSchema) {}

export class UpdateTripWithRoutingDto extends createZodDto(UpdateTripWithRoutingSchema) {}

import { createZodDto } from '@anatine/zod-nestjs';
import {
  AddLocationToBankSchema,
  PromoteLocationToStopSchema,
  RemoveLocationFromBankSchema,
} from '../../types/src/schemas/banking.schema';
import { TripBankedLocationSchema } from '@trip-planner/types';

// Schema for adding a location to bank

// DTOs
export class AddLocationToBankDto extends createZodDto(AddLocationToBankSchema) {}
export class RemoveLocationFromBankDto extends createZodDto(RemoveLocationFromBankSchema) {}
export class PromoteLocationToStopDto extends createZodDto(PromoteLocationToStopSchema) {}
export class TripBankedLocationDto extends createZodDto(TripBankedLocationSchema) {}

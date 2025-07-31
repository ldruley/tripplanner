import { createZodDto } from '@anatine/zod-nestjs';
import {
  TripParticipantSchema,
  AddParticipantToTripSchema,
  UpdateParticipantRoleSchema,
  TripParticipantListResponseSchema,
} from '@trip-planner/types';

export class TripParticipantDto extends createZodDto(TripParticipantSchema) {}
export class AddParticipantToTripDto extends createZodDto(AddParticipantToTripSchema) {}
export class UpdateParticipantRoleDto extends createZodDto(UpdateParticipantRoleSchema) {}
export class TripParticipantListResponseDto extends createZodDto(TripParticipantListResponseSchema) {}
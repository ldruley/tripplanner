import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { uuidSchema } from './base.schema';
import { TripParticipantRole } from '@prisma/client';

export const TripParticipantRoleSchema = z.nativeEnum(TripParticipantRole);

export const TripParticipantSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the trip participant'),
    tripId: uuidSchema.describe('ID of the trip'),
    userId: uuidSchema.describe('ID of the participating user'),
    role: TripParticipantRoleSchema.describe('Role of the participant in the trip'),
    createdAt: z.coerce.date().describe('When the participant was added'),
    updatedAt: z.coerce.date().describe('When the participant was last updated'),
  }),
  {
    title: 'Trip Participant',
    description: 'Represents a user participating in a trip with a specific role',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      tripId: '550e8400-e29b-41d4-a716-446655440002',
      userId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'PARTICIPANT',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const AddParticipantToTripSchema = extendApi(
  z.object({
    userId: uuidSchema.describe('ID of the user to add as participant'),
    role: TripParticipantRoleSchema.default('PARTICIPANT').describe(
      'Role to assign to the participant',
    ),
  }),
  {
    title: 'Add Participant to Trip',
    description: 'Schema for adding a participant to a trip',
    example: {
      userId: '550e8400-e29b-41d4-a716-446655440003',
      role: 'PARTICIPANT',
    },
  },
);

export const UpdateParticipantRoleSchema = extendApi(
  z.object({
    role: TripParticipantRoleSchema.describe('New role for the participant'),
  }),
  {
    title: 'Update Participant Role',
    description: "Schema for updating a participant's role",
    example: {
      role: 'EDITOR',
    },
  },
);

export const TripParticipantListResponseSchema = extendApi(
  z.object({
    participants: z.array(TripParticipantSchema),
    total: z.number().describe('Total number of participants'),
  }),
  {
    title: 'Trip Participant List Response',
    description: 'Response containing list of trip participants',
  },
);

// Type exports
export type TripParticipant = z.infer<typeof TripParticipantSchema>;
export type AddParticipantToTrip = z.infer<typeof AddParticipantToTripSchema>;
export type UpdateParticipantRole = z.infer<typeof UpdateParticipantRoleSchema>;
export type TripParticipantListResponse = z.infer<typeof TripParticipantListResponseSchema>;

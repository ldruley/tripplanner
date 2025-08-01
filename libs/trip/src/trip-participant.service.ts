import { Injectable, Logger, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { TripParticipantRole } from '@prisma/client';
import { TripParticipantRepository } from './trip-participant.repository';
import { TripRepository } from './trip.repository';
import { TripPermissionService } from './trip-permission.service';
import { TripPermission } from './trip-permission.constants';
import {
  TripParticipant,
  AddParticipantToTrip,
  UpdateParticipantRole,
  TripParticipantListResponse
} from '@trip-planner/types';

@Injectable()
export class TripParticipantService {
  private readonly logger = new Logger(TripParticipantService.name);

  constructor(
    private tripParticipantRepository: TripParticipantRepository,
    private tripRepository: TripRepository,
    private tripPermissionService: TripPermissionService
  ) {}

  async addParticipant(
    tripId: string,
    data: AddParticipantToTrip,
    requesterId: string
  ): Promise<TripParticipant> {
    // Check if requester has permission to manage participants
    await this.tripPermissionService.requirePermission(tripId, requesterId, TripPermission.MANAGE_PARTICIPANTS);

    // Check if user is already a participant
    const existingParticipant = await this.tripParticipantRepository.findParticipant(tripId, data.userId);
    if (existingParticipant) {
      throw new ConflictException(`User is already a participant in this trip`);
    }

    // Prevent adding OWNER role through this method
    if (data.role === TripParticipantRole.OWNER) {
      throw new ForbiddenException('Cannot assign OWNER role through add participant. Transfer ownership separately.');
    }

    // Add the participant
    const participant = await this.tripParticipantRepository.addParticipant(
      tripId,
      data.userId,
      data.role
    );

    this.logger.log(`User ${data.userId} added as ${data.role} to trip ${tripId} by ${requesterId}`);
    return participant;
  }

  async removeParticipant(
    tripId: string,
    userId: string,
    requesterId: string
  ): Promise<void> {
    // Check if requester has permission to manage participants
    await this.tripPermissionService.requirePermission(tripId, requesterId, TripPermission.MANAGE_PARTICIPANTS);

    // Check if participant exists
    const participant = await this.tripParticipantRepository.findParticipant(tripId, userId);
    if (!participant) {
      throw new NotFoundException(`Participant not found in this trip`);
    }

    // Prevent removing OWNER
    if (participant.role === TripParticipantRole.OWNER) {
      throw new ForbiddenException('Cannot remove trip owner. Transfer ownership first.');
    }

    // Remove the participant
    await this.tripParticipantRepository.removeParticipant(tripId, userId);

    this.logger.log(`User ${userId} removed from trip ${tripId} by ${requesterId}`);
  }

  async updateParticipantRole(
    tripId: string,
    userId: string,
    data: UpdateParticipantRole,
    requesterId: string
  ): Promise<TripParticipant> {
    // Check if requester has permission to manage participants
    await this.tripPermissionService.requirePermission(tripId, requesterId, TripPermission.MANAGE_PARTICIPANTS);

    // Check if participant exists
    const participant = await this.tripParticipantRepository.findParticipant(tripId, userId);
    if (!participant) {
      throw new NotFoundException(`Participant not found in this trip`);
    }

    // Prevent modifying OWNER role or assigning OWNER role
    if (participant.role === TripParticipantRole.OWNER || data.role === TripParticipantRole.OWNER) {
      throw new ForbiddenException('Cannot modify or assign OWNER role. Use ownership transfer instead.');
    }

    // Update the participant role
    const updatedParticipant = await this.tripParticipantRepository.updateParticipantRole(
      tripId,
      userId,
      data.role
    );

    this.logger.log(`User ${userId} role updated to ${data.role} in trip ${tripId} by ${requesterId}`);
    return updatedParticipant;
  }

  async getParticipants(tripId: string, requesterId: string): Promise<TripParticipantListResponse> {
    // Check if requester has read access to the trip
    await this.tripPermissionService.requirePermission(tripId, requesterId, TripPermission.READ);

    const participants = await this.tripParticipantRepository.findParticipantsByTripId(tripId);

    return {
      participants,
      total: participants.length,
    };
  }

  async getUserParticipatedTrips(userId: string): Promise<TripParticipant[]> {
    return this.tripParticipantRepository.findUserParticipatedTrips(userId);
  }

  async getUserRoleInTrip(tripId: string, userId: string): Promise<TripParticipantRole | null> {
    return this.tripParticipantRepository.getUserRoleInTrip(tripId, userId);
  }

  async isUserParticipant(tripId: string, userId: string): Promise<boolean> {
    return this.tripParticipantRepository.isUserParticipant(tripId, userId);
  }


}

import { Injectable, Logger, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { TripParticipantRole } from '@prisma/client';
import { TripParticipantRepository } from './trip-participant.repository';
import { TripRepository } from './trip.repository';
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
    private tripRepository: TripRepository
  ) {}

  async addParticipant(
    tripId: string,
    data: AddParticipantToTrip,
    requesterId: string
  ): Promise<TripParticipant> {
    // Verify trip exists
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // Check if requester has permission to add participants
    await this.validateParticipantManagementPermission(tripId, requesterId);

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
    // Verify trip exists
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // Check if participant exists
    const participant = await this.tripParticipantRepository.findParticipant(tripId, userId);
    if (!participant) {
      throw new NotFoundException(`Participant not found in this trip`);
    }

    // Prevent removing OWNER
    if (participant.role === TripParticipantRole.OWNER) {
      throw new ForbiddenException('Cannot remove trip owner. Transfer ownership first.');
    }

    // Check permissions
    await this.validateParticipantManagementPermission(tripId, requesterId);

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
    // Verify trip exists
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // Check if participant exists
    const participant = await this.tripParticipantRepository.findParticipant(tripId, userId);
    if (!participant) {
      throw new NotFoundException(`Participant not found in this trip`);
    }

    // Prevent modifying OWNER role or assigning OWNER role
    if (participant.role === TripParticipantRole.OWNER || data.role === TripParticipantRole.OWNER) {
      throw new ForbiddenException('Cannot modify or assign OWNER role. Use ownership transfer instead.');
    }

    // Check permissions
    await this.validateParticipantManagementPermission(tripId, requesterId);

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
    // Verify trip exists and user has access
    await this.validateTripAccess(tripId, requesterId);

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

  // Helper methods for permission validation

  private async validateTripAccess(tripId: string, userId: string): Promise<void> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // Check if user is trip owner or participant
    const isOwner = trip.userId === userId;
    const isParticipant = await this.tripParticipantRepository.isUserParticipant(tripId, userId);

    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('You do not have access to this trip');
    }
  }

  private async validateParticipantManagementPermission(tripId: string, userId: string): Promise<void> {
    const trip = await this.tripRepository.findById(tripId);
    if (!trip) {
      throw new NotFoundException(`Trip with ID ${tripId} not found`);
    }

    // Only trip owner and EDITOR participants can manage participants
    const isOwner = trip.userId === userId;
    const userRole = await this.tripParticipantRepository.getUserRoleInTrip(tripId, userId);
    const canManage = isOwner || userRole === TripParticipantRole.EDITOR;

    if (!canManage) {
      throw new ForbiddenException('You do not have permission to manage participants for this trip');
    }
  }
}
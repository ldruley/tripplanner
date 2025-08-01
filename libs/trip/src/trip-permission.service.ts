import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TripParticipantRole } from '@prisma/client';
import { TripRepository } from './trip.repository';
import { TripParticipantRepository } from './trip-participant.repository';
import { TripPermission, getRolePermissions } from '@trip-planner/types';

/**
 * Interface for user permissions result
 */
export interface UserTripPermissions {
  userId: string;
  tripId: string;
  role: TripParticipantRole | null;
  permissions: TripPermission[];
  isOwner: boolean;
  isParticipant: boolean;
}

/**
 * Central service for managing trip permissions
 * Provides a unified way to check permissions across the trip domain
 */
@Injectable()
export class TripPermissionService {
  private readonly logger = new Logger(TripPermissionService.name);

  constructor(
    private tripRepository: TripRepository,
    private tripParticipantRepository: TripParticipantRepository
  ) {}

  /**
   * Get all permissions for a user in a specific trip
   * @param tripId - The trip ID
   * @param userId - The user ID
   * @returns Complete permission information for the user
   */
  async getUserPermissions(tripId: string, userId: string): Promise<UserTripPermissions> {
    try {
      // Check if trip exists
      const trip = await this.tripRepository.findById(tripId, {});
      if (!trip) {
        throw new NotFoundException(`Trip with ID ${tripId} not found`);
      }

      // Check if user is the trip owner
      const isOwner = trip.userId === userId;
      
      // Get user's participant role if they are a participant
      const participantRole = await this.tripParticipantRepository.getUserRoleInTrip(tripId, userId);
      const isParticipant = !!participantRole;

      // Determine effective role (owner takes precedence)
      let effectiveRole: TripParticipantRole | null = null;
      let permissions: TripPermission[] = [];

      if (isOwner) {
        // Owner has OWNER role permissions regardless of participant status
        effectiveRole = TripParticipantRole.OWNER;
        permissions = getRolePermissions(TripParticipantRole.OWNER);
      } else if (participantRole) {
        // User is a participant with specific role
        effectiveRole = participantRole;
        permissions = getRolePermissions(participantRole);
      }
      // If neither owner nor participant, permissions remain empty

      return {
        userId,
        tripId,
        role: effectiveRole,
        permissions,
        isOwner,
        isParticipant,
      };
    } catch (error) {
      this.logger.error(`Failed to get user permissions for user ${userId} in trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Check if a user has a specific permission for a trip
   * @param tripId - The trip ID
   * @param userId - The user ID
   * @param permission - The permission to check
   * @returns True if user has the permission, false otherwise
   */
  async hasPermission(tripId: string, userId: string, permission: TripPermission): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(tripId, userId);
      return userPermissions.permissions.includes(permission);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      this.logger.error(`Failed to check permission ${permission} for user ${userId} in trip ${tripId}`, error);
      throw error;
    }
  }

  /**
   * Require a user to have a specific permission, throwing an error if they don't
   * @param tripId - The trip ID
   * @param userId - The user ID
   * @param permission - The required permission
   * @throws ForbiddenException if user doesn't have the permission
   * @throws NotFoundException if trip doesn't exist
   */
  async requirePermission(tripId: string, userId: string, permission: TripPermission): Promise<void> {
    const userPermissions = await this.getUserPermissions(tripId, userId);
    
    if (!userPermissions.permissions.includes(permission)) {
      const roleInfo = userPermissions.role ? ` (role: ${userPermissions.role})` : ' (no access)';
      this.logger.warn(`User ${userId}${roleInfo} denied ${permission} permission for trip ${tripId}`);
      throw new ForbiddenException(`You do not have permission to perform this action`);
    }

    this.logger.debug(`User ${userId} granted ${permission} permission for trip ${tripId}`);
  }

  /**
   * Check if a user has access to a trip (any permission)
   * @param tripId - The trip ID
   * @param userId - The user ID
   * @returns True if user has any access to the trip
   */
  async hasAccess(tripId: string, userId: string): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(tripId, userId);
      return userPermissions.permissions.length > 0;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Require a user to have access to a trip, throwing an error if they don't
   * @param tripId - The trip ID
   * @param userId - The user ID
   * @throws ForbiddenException if user doesn't have access
   * @throws NotFoundException if trip doesn't exist
   */
  async requireAccess(tripId: string, userId: string): Promise<void> {
    const hasAccess = await this.hasAccess(tripId, userId);
    
    if (!hasAccess) {
      this.logger.warn(`User ${userId} denied access to trip ${tripId}`);
      throw new ForbiddenException('You do not have access to this trip');
    }

    this.logger.debug(`User ${userId} granted access to trip ${tripId}`);
  }

  /**
   * Get all trips that a user has access to (as owner or participant)
   * This is a helper method for filtering trip queries
   * @param userId - The user ID
   * @returns Object with owned trip IDs and participated trip IDs
   */
  async getUserAccessibleTripIds(userId: string): Promise<{
    ownedTripIds: string[];
    participatedTripIds: string[];
    allAccessibleTripIds: string[];
  }> {
    try {
      // Get trips owned by user
      const ownedTrips = await this.tripRepository.findByUserId(userId);
      const ownedTripIds = ownedTrips.map(trip => trip.id);

      // Get trips where user is a participant
      const participatedTrips = await this.tripParticipantRepository.findUserParticipatedTrips(userId);
      const participatedTripIds = participatedTrips.map(participant => participant.tripId);

      // Combine and deduplicate (in case user owns a trip they also participate in)
      const allAccessibleTripIds = [...new Set([...ownedTripIds, ...participatedTripIds])];

      return {
        ownedTripIds,
        participatedTripIds,
        allAccessibleTripIds,
      };
    } catch (error) {
      this.logger.error(`Failed to get accessible trip IDs for user ${userId}`, error);
      throw error;
    }
  }
}
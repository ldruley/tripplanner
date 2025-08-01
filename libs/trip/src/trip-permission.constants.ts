import { TripParticipantRole } from '@prisma/client';

/**
 * Enumeration of all possible trip permissions
 */
export enum TripPermission {
  READ = 'READ',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  MANAGE_PARTICIPANTS = 'MANAGE_PARTICIPANTS',
  TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP',
}

/**
 * Static mapping between participant roles and their allowed permissions
 */
export const ROLE_PERMISSIONS: Record<TripParticipantRole, TripPermission[]> = {
  [TripParticipantRole.OWNER]: [
    TripPermission.READ,
    TripPermission.EDIT,
    TripPermission.DELETE,
    TripPermission.MANAGE_PARTICIPANTS,
    TripPermission.TRANSFER_OWNERSHIP,
  ],
  [TripParticipantRole.EDITOR]: [
    TripPermission.READ,
    TripPermission.EDIT,
    TripPermission.MANAGE_PARTICIPANTS,
  ],
  [TripParticipantRole.PARTICIPANT]: [
    TripPermission.READ,
  ],
};

/**
 * Helper function to get all permissions for a given role
 */
export function getRolePermissions(role: TripParticipantRole): TripPermission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Helper function to check if a role has a specific permission
 */
export function roleHasPermission(role: TripParticipantRole, permission: TripPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}
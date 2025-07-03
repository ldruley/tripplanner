import { Profile, UpdateProfile, ProfileResponse } from '@trip-planner/types';

//TODO: reconsider this, maybe just export the types directly from the package

export type { Profile, UpdateProfile, ProfileResponse };

export type UpdateProfileRequest = UpdateProfile;
export type ProfileApiResponse = ProfileResponse;

export interface UserProfile extends Profile {
  email: string;
  role: 'user' | 'admin' | 'moderator';
}

export interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  isEditing: boolean;
}

export interface ProfileFormData {
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string;
}

// Cache configuration
export interface ProfileCacheConfig {
  ttl: number; // Time to live in milliseconds
  maxAge: number; // Maximum age before forced refresh
}

// Error types
export type ProfileError =
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface ProfileErrorDetails {
  type: ProfileError;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

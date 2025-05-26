import { Prisma, profiles as PrismaProfile } from '@trip-planner/prisma';
import { Profile, UpdateProfile } from '@trip-planner/types'; // Zod-inferred type

export function toProfileDto(profile: PrismaProfile): Profile {
  return {
    id: profile.id,
    email: profile.email,
    first_name: profile.first_name,
    last_name: profile.last_name,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
    status: profile.status,
    last_sign_in_at: profile.last_sign_in_at,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    onboarding_completed: profile.onboarding_completed,
  };
}

export function toProfileDtoArray(profiles: PrismaProfile[]): Profile[] {
  return profiles.map(toProfileDto);
}

export function toPrismaUpdateInput(dto: UpdateProfile): Prisma.profilesUpdateInput {
  return {
    ...dto,
    updated_at: new Date(),
  };
}

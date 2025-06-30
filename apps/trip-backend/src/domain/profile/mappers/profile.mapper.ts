import { Prisma, Profile as PrismaProfile } from '@trip-planner/prisma';
import { Profile, UpdateProfile } from '@trip-planner/types';

export function toProfileDto(profile: PrismaProfile): Profile {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    status: profile.status,
    lastSignInAt: profile.lastSignInAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    onboardingCompleted: profile.onboardingCompleted,
  };
}

export function toProfileDtoArray(profiles: PrismaProfile[]): Profile[] {
  return profiles.map(toProfileDto);
}

export function toPrismaUpdateInput(dto: UpdateProfile): Prisma.ProfileUpdateInput {
  return {
    ...dto,
    updatedAt: new Date(),
  };
}

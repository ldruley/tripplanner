import { PrismaClient } from '@trip-planner/prisma';
import {
  CreateProfile,
  Profile,
  ProfileQuery,
  UpdateProfile
} from '../../../../../../libs/shared/types/src/schemas/profile.schema';


export abstract class ProfileRepository {
  abstract findById(id: string, client?: PrismaClient): Promise<Profile | null>;
  abstract findByEmail(email: string, client?: PrismaClient): Promise<Profile | null>;
  abstract update(id: string, data: UpdateProfile, client?: PrismaClient): Promise<Profile>;
  abstract delete(id: string, client?: PrismaClient): Promise<void>;
  abstract findMany(query: ProfileQuery, client?: PrismaClient): Promise<{
    profiles: Profile[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>;
  abstract exists(id: string, client?: PrismaClient): Promise<boolean>;
}

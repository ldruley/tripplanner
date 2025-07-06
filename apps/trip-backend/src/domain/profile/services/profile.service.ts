import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '@trip-planner/prisma';
import {
  UpdateProfile,
  Profile,
  ProfileQuery,
  ProfilesListResponse,
  UpdateProfileSchema,
  ProfileQuerySchema,
} from '@trip-planner/types';
import { ProfileRepository } from '../repositories/profile.repository';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find a profile by ID
   * @param id - The ID of the profile to find
   * @return A promise that resolves to the found profile
   */
  async findById(id: string): Promise<Profile> {
    this.logger.log(`Finding profile by ID: ${id}`);

    const profile = await this.profileRepository.findById(id);
    if (!profile) {
      this.logger.warn(`Profile with ID ${id} not found`);
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }

    return profile;
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const profile = await this.profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException(`Profile for user with ID ${userId} not found`);
    }
    return profile;
  }

  /**
   * Find a profile by email
   * @param email - The email of the profile to find
   * @return A promise that resolves to the found profile or null if not found
   */
  /*async findByEmail(email: string): Promise<Profile | null> {
    this.logger.debug(`Finding profile by email: ${email}`);
    return this.profileRepository.findByEmail(email);
  }*/

  /**
   * Update a profile
   * @param id - The ID of the profile to update
   * @param data - The UpdateProfile data for the updated profile
   * @return A promise that resolves to the updated profile
   */
  async update(id: string, data: UpdateProfile): Promise<Profile> {
    this.logger.debug(`Updating profile: ${id}`);

    // Validate input data
    const validatedData = UpdateProfileSchema.parse(data);

    // Check if profile exists
    const existingProfile = await this.profileRepository.findByUserId(id);
    if (!existingProfile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }

    // Update profile
    const updatedProfile = await this.profileRepository.update(existingProfile.id, validatedData);

    this.logger.log(`Profile updated successfully: ${id}`);
    return updatedProfile;
  }

  /**
   * Create a new profile
   * @param query - The ProfileQuery data for the new profile
   * @return A promise that resolves to the created profile
   */
  async findMany(query: ProfileQuery): Promise<ProfilesListResponse> {
    this.logger.debug(`Finding profiles: ${JSON.stringify(query)}`);

    // Validate query parameters
    const validatedQuery = ProfileQuerySchema.parse(query);

    // Fetch profiles from repository
    const result = await this.profileRepository.findMany(validatedQuery);

    return {
      success: true,
      data: result,
      message: `Found ${result.total} profiles`,
    };
  }

  async exists(id: string): Promise<boolean> {
    return this.profileRepository.exists(id);
  }

}

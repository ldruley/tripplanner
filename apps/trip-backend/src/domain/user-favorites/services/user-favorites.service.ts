import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { UserFavoriteLocationRepository } from '../repositories/user-favorites.repository';
import {
  CreateUserFavoriteLocation,
  UpdateUserFavoriteLocation,
  UserFavoriteLocation,
} from '@trip-planner/types';

@Injectable()
export class UserFavoritesService {
  private readonly logger = new Logger(UserFavoritesService.name);

  constructor(private readonly userFavoriteLocationRepository: UserFavoriteLocationRepository) {}

  async getUserFavorites(userId: string): Promise<UserFavoriteLocation[]> {
    this.logger.debug(`Getting user favorites for user: ${userId}`);

    const favorites = await this.userFavoriteLocationRepository.findByUserId(userId);

    this.logger.debug(`Found ${favorites.length} favorites for user: ${userId}`);
    return favorites;
  }

  async addToFavorites(
    userId: string,
    data: CreateUserFavoriteLocation,
  ): Promise<UserFavoriteLocation> {
    this.logger.debug(
      `Adding location to favorites for user: ${userId}, locationId: ${data.locationId}`,
    );

    // Check if location is already in favorites
    const existingFavorite = await this.userFavoriteLocationRepository.findByUserAndLocation(
      userId,
      data.locationId,
    );

    if (existingFavorite) {
      throw new ConflictException('Location is already in favorites');
    }

    const favorite = await this.userFavoriteLocationRepository.create({
      ...data,
      userId,
    });

    this.logger.debug(`Added location to favorites: ${favorite.id}`);
    return favorite;
  }

  async removeFromFavorites(userId: string, locationId: string): Promise<void> {
    this.logger.debug(
      `Removing location from favorites for user: ${userId}, locationId: ${locationId}`,
    );

    const favorite = await this.userFavoriteLocationRepository.findByUserAndLocation(
      userId,
      locationId,
    );

    if (!favorite) {
      throw new NotFoundException('Favorite location not found');
    }

    await this.userFavoriteLocationRepository.delete(favorite.id);
    this.logger.debug(`Removed location from favorites: ${favorite.id}`);
  }

  async updateFavoriteMetadata(
    userId: string,
    locationId: string,
    data: UpdateUserFavoriteLocation,
  ): Promise<UserFavoriteLocation> {
    this.logger.debug(`Updating favorite metadata for user: ${userId}, locationId: ${locationId}`);

    const favorite = await this.userFavoriteLocationRepository.findByUserAndLocation(
      userId,
      locationId,
    );

    if (!favorite) {
      throw new NotFoundException('Favorite location not found');
    }

    const updatedFavorite = await this.userFavoriteLocationRepository.update(favorite.id, data);
    this.logger.debug(`Updated favorite metadata: ${updatedFavorite.id}`);

    return updatedFavorite;
  }

  async isFavorite(userId: string, locationId: string): Promise<boolean> {
    this.logger.debug(
      `Checking if location is favorite for user: ${userId}, locationId: ${locationId}`,
    );

    const favorite = await this.userFavoriteLocationRepository.findByUserAndLocation(
      userId,
      locationId,
    );

    return !!favorite;
  }
}

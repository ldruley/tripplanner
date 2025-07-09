import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@trip-planner/prisma';
import {
  CreateUserFavoriteLocation,
  UpdateUserFavoriteLocation,
  UserFavoriteLocationWithLocation,
} from '@trip-planner/types';

@Injectable()
export class UserFavoriteLocationRepository {
  private readonly logger = new Logger(UserFavoriteLocationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserFavoriteLocationWithLocation[]> {
    this.logger.debug(`Finding favorites for user: ${userId}`);

    return this.prisma.userFavoriteLocation.findMany({
      where: { userId },
      include: {
        location: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByUserAndLocation(
    userId: string,
    locationId: string,
  ): Promise<UserFavoriteLocationWithLocation | null> {
    this.logger.debug(`Finding favorite for user: ${userId}, location: ${locationId}`);

    return this.prisma.userFavoriteLocation.findFirst({
      where: {
        userId,
        locationId,
      },
      include: {
        location: true,
      },
    });
  }

  async create(
    data: CreateUserFavoriteLocation & { userId: string },
  ): Promise<UserFavoriteLocationWithLocation> {
    this.logger.debug(`Creating favorite for user: ${data.userId}, location: ${data.locationId}`);

    return this.prisma.userFavoriteLocation.create({
      data: {
        userId: data.userId,
        locationId: data.locationId,
        alias: data.alias,
        tags: data.tags,
        notes: data.notes,
      },
      include: {
        location: true,
      },
    });
  }

  async update(
    id: string,
    data: UpdateUserFavoriteLocation,
  ): Promise<UserFavoriteLocationWithLocation> {
    this.logger.debug(`Updating favorite: ${id}`);

    return this.prisma.userFavoriteLocation.update({
      where: { id },
      data,
      include: {
        location: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`Deleting favorite: ${id}`);

    await this.prisma.userFavoriteLocation.delete({
      where: { id },
    });
  }
}

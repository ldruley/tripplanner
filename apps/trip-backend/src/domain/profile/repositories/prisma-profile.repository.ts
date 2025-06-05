import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@trip-planner/prisma';
import { toPrismaUpdateInput, toProfileDto, toProfileDtoArray } from '../mappers/profile.mapper';

import { PrismaClient } from '@prisma/client';
import { ProfileRepository } from './profile.repository';
import { CreateProfile, Profile, ProfileQuery, UpdateProfile } from '../../../../../../libs/shared/types/src/schemas/profile.schema';

@Injectable()
export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(client?: PrismaClient): PrismaClient {
    return client || this.prisma;
  }

  async findById(id: string, client?: PrismaClient): Promise<Profile | null> {
    const prismaClient = this.getClient(client);
    const result = await prismaClient.profile.findUnique({
      where: { id }
    });

    if(!result) {
      return null;
    }

    return result ? toProfileDto(result) : null;
  }

  async findByEmail(email: string, client?: PrismaClient): Promise<Profile | null> {
    const prismaClient = this.getClient(client);
    const result = await prismaClient.profile.findUnique({
      where: { email }
    });

    if(!result) {
      return null;
    }

    return result ? toProfileDto(result) : null;
  }

  async update(id: string, data: UpdateProfile, client?: PrismaClient): Promise<Profile> {
    const prismaClient = this.getClient(client);
    const updateInput = toPrismaUpdateInput(data);

    return prismaClient.profile.update({
      where: { id },
      data: updateInput,
    });
  }

  async delete(id: string, client?: PrismaClient): Promise<void> {
    const prismaClient = this.getClient(client);
    await prismaClient.profile.delete({
      where: { id }
    });
  }

  async exists(id: string, client?: PrismaClient): Promise<boolean> {
    const prismaClient = this.getClient(client);
    const count = await prismaClient.profile.count({
      where: { id }
    });
    return count > 0;
  }

  async findMany(query: ProfileQuery, client?: PrismaClient): Promise<{
    profiles: Profile[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const prismaClient = this.getClient(client);
    const { page, limit, search, role, status, sortBy, sortOrder } = query;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { display_name: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Execute queries in parallel
    const [profiles, total] = await Promise.all([
      prismaClient.profile.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit }),
      prismaClient.profile.count({ where })
    ]);

    return {
      profiles: toProfileDtoArray(profiles),
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }
}

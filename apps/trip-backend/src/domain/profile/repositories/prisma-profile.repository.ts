import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@trip-planner/prisma';

import { PrismaClient } from '@trip-planner/prisma';
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
    const result = await prismaClient.profiles.findUnique({
      where: { id }
    });

    if(!result) {
      return null;
    }

    return {
      ...result };
  }

  async findByEmail(email: string, client?: PrismaClient): Promise<Profile | null> {
    const prismaClient = this.getClient(client);
    const result = await prismaClient.profiles.findUnique({
      where: { email }
    });

    if(!result) {
      return null;
    }
    return {
      ...result };
  }

  async update(id: string, data: UpdateProfile, client?: PrismaClient): Promise<Profile> {
    const prismaClient = this.getClient(client);
    return prismaClient.profiles.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date() }
    });
  }

  async delete(id: string, client?: PrismaClient): Promise<void> {
    const prismaClient = this.getClient(client);
    await prismaClient.profiles.delete({
      where: { id }
    });
  }

  async exists(id: string, client?: PrismaClient): Promise<boolean> {
    const prismaClient = this.getClient(client);
    const count = await prismaClient.profiles.count({
      where: { id }
    });
    return count > 0;
  }

  async updateLastSignIn(id: string, client?: PrismaClient): Promise<void> {
    const prismaClient = this.getClient(client);
    await prismaClient.profiles.update({
      where: { id },
      data: {
        last_sign_in_at: new Date(),
        updated_at: new Date() }
    });
  }

  async findMany(query: ProfileQuery, client?: PrismaClient): Promise<{
    profiles: Profile[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const prismaClient = this.getClient(client);
    const { page, limit, search, role, status, sort_by, sort_order } = query;

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
      prismaClient.profiles.findMany({
        where,
        orderBy: { [sort_by]: sort_order },
        skip: (page - 1) * limit,
        take: limit }),
      prismaClient.profiles.count({ where })
    ]);

    return {
      profiles,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    };
  }
}

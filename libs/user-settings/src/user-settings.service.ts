import { Injectable } from '@nestjs/common';
import { PrismaService } from '@trip-planner/prisma';
import { CreateUserSettings, UpdateUserSettings } from '@trip-planner/types';

@Injectable()
export class UserSettingsService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    return this.prisma.userSettings.findUnique({ where: { userId } });
  }

  async create(userId: string, data: CreateUserSettings) {
    return this.prisma.userSettings.create({
      data: { ...data, userId },
    });
  }

  async update(userId: string, data: UpdateUserSettings) {
    return this.prisma.userSettings.update({
      where: { userId },
      data,
    });
  }

  async upsert(userId: string, data: UpdateUserSettings) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { ...data, userId },
      update: data,
    });
  }
}

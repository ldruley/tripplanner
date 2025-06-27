import { Body, Controller, Get, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../apps/trip-backend/src/infrastructure/auth/guards/jwt-auth-guard';
import { UserSettingsService } from './user-settings.service';
import { CurrentUser } from '../../../apps/trip-backend/src/infrastructure/auth/decorators/current-user.decorator';
import {
  CreateUserSettings,
  SafeUser, UpdateUserSettings,
} from '@trip-planner/types';
import {
  CreateUserSettingsDto,
  UpdateUserSettingsDto,
} from '@trip-planner/shared/dtos';

@UseGuards(JwtAuthGuard)
@Controller('user-settings')
export class UserSettingsController {
  constructor(private service: UserSettingsService) {}

  @Get()
  async getSettings(@CurrentUser() user: SafeUser) {
    return this.service.findByUserId(user.id);
  }

  @Post()
  async createSettings(@CurrentUser() user: SafeUser, @Body() dto: CreateUserSettingsDto) {
    return this.service.create(user.id, dto as CreateUserSettings);
  }

  @Patch()
  async updateSettings(@CurrentUser() user: SafeUser, @Body() dto: UpdateUserSettingsDto) {
    return this.service.update(user.id, dto as UpdateUserSettings);
  }

  @Put()
  async upsertSettings(@CurrentUser() user: SafeUser, @Body() dto: UpdateUserSettingsDto) {
    return this.service.upsert(user.id, dto as UpdateUserSettings);
  }
}

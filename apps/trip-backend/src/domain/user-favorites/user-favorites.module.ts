import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { UserFavoritesService } from './services/user-favorites.service';
import { UserFavoriteLocationRepository } from './repositories/user-favorites.repository';
import { UserFavoritesController } from './controllers/user-favorites.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UserFavoritesController],
  providers: [
    UserFavoritesService,
    UserFavoriteLocationRepository,
  ],
  exports: [UserFavoritesService, UserFavoriteLocationRepository],
})
export class UserFavoritesModule {}
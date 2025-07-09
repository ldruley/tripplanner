import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserFavoritesService } from '../services/user-favorites.service';
import { SafeUser } from '@trip-planner/types';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import {
  CreateUserFavoriteLocationDto,
  UpdateUserFavoriteLocationDto,
  UserFavoriteLocationWithLocationDto,
  ErrorResponseDto,
} from '@trip-planner/shared/dtos';

@ApiTags('User Favorites')
@Controller('user-favorites')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class UserFavoritesController {
  private readonly logger = new Logger(UserFavoritesController.name);

  constructor(private readonly userFavoritesService: UserFavoritesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user favorite locations',
    description: 'Retrieve all favorite locations for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User favorites retrieved successfully',
    type: [UserFavoriteLocationWithLocationDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async getUserFavorites(@CurrentUser() user: SafeUser) {
    this.logger.debug(`GET /user-favorites - User: ${user.id}`);

    const favorites = await this.userFavoritesService.getUserFavorites(user.id);
    return {
      success: true,
      data: favorites,
      message: 'User favorites retrieved successfully',
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Add location to favorites',
    description: 'Add a location to the authenticated user\'s favorites',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Location added to favorites successfully',
    type: UserFavoriteLocationWithLocationDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Location is already in favorites',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async addToFavorites(
    @CurrentUser() user: SafeUser,
    @Body() createUserFavoriteLocationDto: CreateUserFavoriteLocationDto,
  ) {
    this.logger.debug(
      `POST /user-favorites - User: ${user.id} - Data: ${JSON.stringify(createUserFavoriteLocationDto)}`,
    );

    const favorite = await this.userFavoritesService.addToFavorites(
      user.id,
      createUserFavoriteLocationDto,
    );
    return {
      success: true,
      data: favorite,
      message: 'Location added to favorites successfully',
    };
  }

  @Delete(':locationId')
  @ApiOperation({
    summary: 'Remove location from favorites',
    description: 'Remove a location from the authenticated user\'s favorites',
  })
  @ApiParam({
    name: 'locationId',
    description: 'Location UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Location removed from favorites successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Favorite location not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async removeFromFavorites(
    @CurrentUser() user: SafeUser,
    @Param('locationId') locationId: string,
  ) {
    this.logger.debug(`DELETE /user-favorites/${locationId} - User: ${user.id}`);

    await this.userFavoritesService.removeFromFavorites(user.id, locationId);
    return {
      success: true,
      message: 'Location removed from favorites successfully',
    };
  }

  @Put(':locationId')
  @ApiOperation({
    summary: 'Update favorite location metadata',
    description: 'Update the metadata (alias, notes, tags) for a favorite location',
  })
  @ApiParam({
    name: 'locationId',
    description: 'Location UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Favorite location metadata updated successfully',
    type: UserFavoriteLocationWithLocationDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Favorite location not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async updateFavoriteMetadata(
    @CurrentUser() user: SafeUser,
    @Param('locationId') locationId: string,
    @Body() updateUserFavoriteLocationDto: UpdateUserFavoriteLocationDto,
  ) {
    this.logger.debug(
      `PUT /user-favorites/${locationId} - User: ${user.id} - Data: ${JSON.stringify(updateUserFavoriteLocationDto)}`,
    );

    const favorite = await this.userFavoritesService.updateFavoriteMetadata(
      user.id,
      locationId,
      updateUserFavoriteLocationDto,
    );
    return {
      success: true,
      data: favorite,
      message: 'Favorite location metadata updated successfully',
    };
  }

  @Get(':locationId/is-favorite')
  @ApiOperation({
    summary: 'Check if location is favorite',
    description: 'Check if a location is in the authenticated user\'s favorites',
  })
  @ApiParam({
    name: 'locationId',
    description: 'Location UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Favorite status retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async isFavorite(
    @CurrentUser() user: SafeUser,
    @Param('locationId') locationId: string,
  ) {
    this.logger.debug(`GET /user-favorites/${locationId}/is-favorite - User: ${user.id}`);

    const isFavorite = await this.userFavoritesService.isFavorite(user.id, locationId);
    return {
      success: true,
      data: { isFavorite },
      message: 'Favorite status retrieved successfully',
    };
  }
}
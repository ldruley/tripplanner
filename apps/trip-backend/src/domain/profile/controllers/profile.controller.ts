import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  HttpStatus,
  UseGuards,
  Logger,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProfileService } from '../services/profile.service';
import { UpdateProfile, SafeUser } from '@trip-planner/types';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import {
  ErrorResponseDto,
  ProfileQueryDto,
  ProfileResponseDto,
  ProfilesListResponseDto,
  UpdateProfileDto,
} from '@trip-planner/shared/dtos';

@ApiTags('Profiles')
@Controller('profiles')
@UsePipes(ZodValidationPipe)
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async getCurrentUserProfile(@CurrentUser() user: SafeUser) {
    this.logger.debug(`GET /profiles/me - User: ${user.id}`);

    const profile = await this.profileService.findByUserId(user.id);
    return {
      success: true,
      data: profile,
      message: 'Profile retrieved successfully',
    };
  }

  @Put('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
    type: ErrorResponseDto,
  })
  async updateCurrentUserProfile(
    @CurrentUser() user: SafeUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    this.logger.debug(
      `PUT /profiles/me - User: ${user.id} - Data: ${JSON.stringify(updateProfileDto)}`,
    );

    const profile = await this.profileService.update(user.id, updateProfileDto as UpdateProfile);
    return {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get profiles with filtering and pagination',
    description:
      'Retrieve a paginated list of profiles with optional filtering by search, role, and status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profiles retrieved successfully',
    type: ProfilesListResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 10, max: 100)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: 'string',
    description: 'Search in email, name, or display name',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['user', 'admin', 'moderator'],
    description: 'Filter by role',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'suspended', 'pending'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    enum: ['created_at', 'updated_at', 'last_sign_in_at', 'email', 'display_name'],
    description: 'Sort field (default: created_at)',
  })
  @ApiQuery({
    name: 'sort_order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  async findMany(@Query() query: ProfileQueryDto) {
    this.logger.debug(`GET /profiles - Query: ${JSON.stringify(query)}`);
    return this.profileService.findMany(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get profile by ID',
    description: 'Retrieve a specific profile by its UUID',
  })
  @ApiParam({
    name: 'id',
    description: 'Profile UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile found',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  async findById(@Param('id') id: string) {
    this.logger.debug(`GET /profiles/${id}`);
    const profile = await this.profileService.findById(id);
    return {
      success: true,
      data: profile,
      message: 'Profile retrieved successfully',
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update profile',
    description: 'Update an existing profile with the provided data',
  })
  @ApiParam({
    name: 'id',
    description: 'Profile UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Profile not found',
    type: ErrorResponseDto,
  })
  async update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
    this.logger.debug(`PUT /profiles/${id} - Data: ${JSON.stringify(updateProfileDto)}`);
    const profile = await this.profileService.update(id, updateProfileDto as UpdateProfile);
    return {
      success: true,
      data: profile,
      message: 'Profile updated successfully',
    };
  }
}

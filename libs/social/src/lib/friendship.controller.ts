import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser } from '@trip-planner/auth';
import { SafeUser } from '@trip-planner/types';
import {
  CreateFriendshipRequestDto,
  UpdateFriendshipRequestDto,
  FriendshipResponseDto,
  FriendshipListResponseDto,
  UserSearchResponseDto,
} from '@trip-planner/shared/dtos';
import { FriendshipService } from './friendship.service';

@ApiTags('friendship')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('friendship')
export class FriendshipController {
  private readonly logger = new Logger(FriendshipController.name);

  constructor(private readonly friendshipService: FriendshipService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Friend request sent successfully',
    type: FriendshipResponseDto,
  })
  async sendFriendRequest(
    @CurrentUser() user: SafeUser,
    @Body() dto: CreateFriendshipRequestDto,
  ): Promise<FriendshipResponseDto> {
    this.logger.debug(`User ${user.id} sending friend request to ${dto.receiverId}`);

    const friendship = await this.friendshipService.sendFriendRequest(user.id, dto);

    return {
      success: true,
      data: friendship,
      message: 'Friend request sent successfully',
    };
  }

  @Put('request/:requestId/respond')
  @ApiOperation({ summary: 'Respond to a friend request (accept/decline)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Friend request response processed successfully',
    type: FriendshipResponseDto,
  })
  async respondToFriendRequest(
    @CurrentUser() user: SafeUser,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: UpdateFriendshipRequestDto,
  ): Promise<FriendshipResponseDto> {
    this.logger.debug(
      `User ${user.id} responding to friend request ${requestId} with status ${dto.status}`,
    );

    const friendship = await this.friendshipService.respondToFriendRequest(requestId, user.id, dto);

    return {
      success: true,
      data: friendship,
      message: `Friend request ${dto.status.toLowerCase()} successfully`,
    };
  }

  @Delete('remove/:friendId')
  @ApiOperation({ summary: 'Remove a friend' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Friend removed successfully',
  })
  async removeFriend(
    @CurrentUser() user: SafeUser,
    @Param('friendId', ParseUUIDPipe) friendId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(`User ${user.id} removing friend ${friendId}`);

    await this.friendshipService.removeFriend(user.id, friendId);

    return {
      success: true,
      message: 'Friend removed successfully',
    };
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get list of accepted friends' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Friends retrieved successfully',
    type: FriendshipListResponseDto,
  })
  async getFriends(@CurrentUser() user: SafeUser): Promise<FriendshipListResponseDto> {
    this.logger.debug(`User ${user.id} retrieving friends list`);

    const friendships = await this.friendshipService.getFriends(user.id);

    return {
      success: true,
      data: friendships,
      message: 'Friends retrieved successfully',
    };
  }

  @Get('requests/pending')
  @ApiOperation({ summary: 'Get pending friend requests received' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending requests retrieved successfully',
    type: FriendshipListResponseDto,
  })
  async getPendingRequests(@CurrentUser() user: SafeUser): Promise<FriendshipListResponseDto> {
    this.logger.debug(`User ${user.id} retrieving pending friend requests`);

    const requests = await this.friendshipService.getPendingRequests(user.id);

    return {
      success: true,
      data: requests,
      message: 'Pending requests retrieved successfully',
    };
  }

  @Get('requests/sent')
  @ApiOperation({ summary: 'Get sent friend requests' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Sent requests retrieved successfully',
    type: FriendshipListResponseDto,
  })
  async getSentRequests(@CurrentUser() user: SafeUser): Promise<FriendshipListResponseDto> {
    this.logger.debug(`User ${user.id} retrieving sent friend requests`);

    const requests = await this.friendshipService.getSentRequests(user.id);

    return {
      success: true,
      data: requests,
      message: 'Sent requests retrieved successfully',
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for users to befriend' })
  @ApiQuery({ name: 'q', description: 'Search term (minimum 2 characters)', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum number of results', required: false })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users found successfully',
    type: UserSearchResponseDto,
  })
  async searchUsers(
    @CurrentUser() user: SafeUser,
    @Query('q') searchTerm: string,
    @Query('limit') limit?: string,
  ): Promise<UserSearchResponseDto> {
    this.logger.debug(`User ${user.id} searching for users with term: ${searchTerm}`);

    const limitNum = limit ? parseInt(limit, 10) : 10;
    const users = await this.friendshipService.searchUsers(searchTerm, user.id, limitNum);

    return {
      success: true,
      data: users,
      message: 'Users found successfully',
    };
  }

  @Get('status/:userId')
  @ApiOperation({ summary: 'Get friendship status with a specific user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Friendship status retrieved successfully',
  })
  async getFriendshipStatus(
    @CurrentUser() user: SafeUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ success: boolean; status: string; message: string }> {
    this.logger.debug(`User ${user.id} checking friendship status with user ${userId}`);

    const status = await this.friendshipService.getFriendshipStatus(user.id, userId);

    return {
      success: true,
      status,
      message: 'Friendship status retrieved successfully',
    };
  }
}

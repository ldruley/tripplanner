import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '@trip-planner/prisma';
import { FriendshipRepository } from './friendship.repository';
import {
  Friendship,
  FriendshipWithUsers,
  CreateFriendshipRequest,
  UpdateFriendshipRequest,
  UserSearchResult,
} from '@trip-planner/types';

@Injectable()
export class FriendshipService {
  constructor(
    private readonly friendshipRepository: FriendshipRepository,
    private readonly prisma: PrismaService,
  ) {}

  async sendFriendRequest(senderId: string, data: CreateFriendshipRequest): Promise<Friendship> {
    if (senderId === data.receiverId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const existingFriendship = await this.friendshipRepository.findByUsers(
      senderId,
      data.receiverId,
    );

    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        throw new ConflictException('Friend request already sent or received');
      }
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        throw new ConflictException('Users are already friends');
      }
      if (existingFriendship.status === FriendshipStatus.DECLINED) {
        await this.friendshipRepository.delete(existingFriendship.id);
      }
    }

    return this.friendshipRepository.create(senderId, data);
  }

  async respondToFriendRequest(
    requestId: string,
    receiverId: string,
    data: UpdateFriendshipRequest,
  ): Promise<Friendship> {
    const friendship = await this.friendshipRepository.findById(requestId);

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    if (friendship.receiverId !== receiverId) {
      throw new BadRequestException('You can only respond to friend requests sent to you');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Friend request has already been responded to');
    }

    if (data.status === FriendshipStatus.ACCEPTED) {
      return await this.prisma.$transaction(async tx => {
        const updatedFriendship = await this.friendshipRepository.update(requestId, data, tx);

        await this.friendshipRepository.create(
          friendship.receiverId,
          { receiverId: friendship.senderId, status: FriendshipStatus.ACCEPTED },
          tx,
        );

        return updatedFriendship;
      });
    }

    return this.friendshipRepository.update(requestId, data);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    if (userId === friendId) {
      throw new BadRequestException('Cannot remove yourself as a friend');
    }

    const friendship = await this.friendshipRepository.findByUsers(userId, friendId);

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.friendshipRepository.deleteBetweenUsers(userId, friendId);
  }

  async getFriends(userId: string): Promise<FriendshipWithUsers[]> {
    return await this.friendshipRepository.findAcceptedFriends(userId);
  }

  async getPendingRequests(userId: string): Promise<FriendshipWithUsers[]> {
    return await this.friendshipRepository.findPendingRequestsForUser(userId);
  }

  async getSentRequests(userId: string): Promise<FriendshipWithUsers[]> {
    const allFriendships = await this.friendshipRepository.findByUserIdWithDetails(
      userId,
      FriendshipStatus.PENDING,
    );

    return allFriendships.filter(f => f.senderId === userId);
  }

  async searchUsers(
    searchTerm: string,
    currentUserId: string,
    limit = 10,
  ): Promise<UserSearchResult[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException('Search term must be at least 2 characters long');
    }

    return this.friendshipRepository.searchUsers(searchTerm, currentUserId, limit);
  }

  async getFriendshipStatus(userId: string, otherUserId: string): Promise<string> {
    if (userId === otherUserId) {
      return 'SELF';
    }

    const friendship = await this.friendshipRepository.findByUsers(userId, otherUserId);

    if (!friendship) {
      return 'NONE';
    }

    if (friendship.status === FriendshipStatus.ACCEPTED) {
      return 'ACCEPTED';
    }

    if (friendship.status === FriendshipStatus.PENDING) {
      if (friendship.senderId === userId) {
        return 'PENDING_SENT';
      } else {
        return 'PENDING_RECEIVED';
      }
    }

    if (friendship.status === FriendshipStatus.DECLINED) {
      return 'DECLINED';
    }

    return 'NONE';
  }
}

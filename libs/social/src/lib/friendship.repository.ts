import { Injectable } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { FriendshipStatus, Prisma } from '@prisma/client';
import {
  Friendship,
  FriendshipWithUsers,
  CreateFriendshipRequest,
  UpdateFriendshipRequest,
  UserSearchResult,
} from '@trip-planner/types';

@Injectable()
export class FriendshipRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getUserIncludeOptions() {
    return {
      sender: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
      receiver: {
        select: {
          id: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
    };
  }

  private getUserProfileSelect() {
    return {
      id: true,
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    };
  }

  async create(
    senderId: string,
    data: CreateFriendshipRequest & { status?: FriendshipStatus },
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Friendship> {
    const client = prismaClient || this.prisma;

    return client.friendship.create({
      data: {
        senderId,
        receiverId: data.receiverId,
        status: data.status || FriendshipStatus.PENDING,
      },
    });
  }

  async findById(id: string, prismaClient?: PrismaClientOrTransaction): Promise<Friendship | null> {
    const client = prismaClient || this.prisma;

    return client.friendship.findUnique({
      where: { id },
    });
  }

  async findByUsers(
    senderId: string,
    receiverId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Friendship | null> {
    const client = prismaClient || this.prisma;

    return client.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
  }

  async findByUserIdWithDetails(
    userId: string,
    status?: FriendshipStatus,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<FriendshipWithUsers[]> {
    const client = prismaClient || this.prisma;

    const whereClause: Prisma.FriendshipWhereInput = {
      OR: [{ senderId: userId }, { receiverId: userId }],
    };

    if (status) {
      whereClause.status = status;
    }

    return client.friendship.findMany({
      where: whereClause,
      include: this.getUserIncludeOptions(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingRequestsForUser(
    userId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<FriendshipWithUsers[]> {
    const client = prismaClient || this.prisma;

    return client.friendship.findMany({
      where: {
        receiverId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: this.getUserIncludeOptions(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAcceptedFriends(
    userId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<FriendshipWithUsers[]> {
    const client = prismaClient || this.prisma;

    return client.friendship.findMany({
      where: {
        OR: [
          { senderId: userId, status: FriendshipStatus.ACCEPTED },
          { receiverId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      },
      include: this.getUserIncludeOptions(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: UpdateFriendshipRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Friendship> {
    const client = prismaClient || this.prisma;

    return client.friendship.update({
      where: { id },
      data: {
        status: data.status,
      },
    });
  }

  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.friendship.delete({
      where: { id },
    });
  }

  async deleteBetweenUsers(
    userId1: string,
    userId2: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.friendship.deleteMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
    });
  }
  async searchUsers(
    searchTerm: string,
    currentUserId: string,
    limit = 10,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<UserSearchResult[]> {
    const client = prismaClient || this.prisma;

    const users = await client.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // Exclude the current user from search results
          {
            OR: [
              { email: { contains: searchTerm, mode: 'insensitive' } },
              {
                profile: {
                  OR: [
                    { firstName: { contains: searchTerm, mode: 'insensitive' } },
                    { lastName: { contains: searchTerm, mode: 'insensitive' } },
                    { displayName: { contains: searchTerm, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          },
        ],
      },
      select: {
        ...this.getUserProfileSelect(), // Reusing the profile select logic
        requester: {
          where: {
            receiverId: currentUserId, // Friendships where the searched user sent to currentUserId
            OR: [
              { status: FriendshipStatus.ACCEPTED },
              { status: FriendshipStatus.PENDING },
              { status: FriendshipStatus.BLOCKED }, // Include blocked status for comprehensive display
              { status: FriendshipStatus.DECLINED },
            ],
          },
          select: {
            status: true,
          },
        },
        addressee: {
          where: {
            senderId: currentUserId, // Friendships where currentUserId sent to the searched user
            OR: [
              { status: FriendshipStatus.ACCEPTED },
              { status: FriendshipStatus.PENDING },
              { status: FriendshipStatus.BLOCKED },
              { status: FriendshipStatus.DECLINED },
            ],
          },
          select: {
            status: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Order by creation date, or adjust as needed
    });

    return users.map(user => {
      let friendshipStatus: UserSearchResult['friendshipStatus'] = 'NONE';

      // Determine friendship status based on fetched relations
      // A request from the searched user to the current user
      const receivedFromSearchedUser = user.requester[0];
      // A request from the current user to the searched user
      const sentToSearchedUser = user.addressee[0];

      if (
        (receivedFromSearchedUser &&
          receivedFromSearchedUser.status === FriendshipStatus.ACCEPTED) ||
        (sentToSearchedUser && sentToSearchedUser.status === FriendshipStatus.ACCEPTED)
      ) {
        friendshipStatus = 'ACCEPTED';
      } else if (sentToSearchedUser && sentToSearchedUser.status === FriendshipStatus.PENDING) {
        friendshipStatus = 'PENDING_SENT';
      } else if (
        receivedFromSearchedUser &&
        receivedFromSearchedUser.status === FriendshipStatus.PENDING
      ) {
        friendshipStatus = 'PENDING_RECEIVED';
      } else if (sentToSearchedUser && sentToSearchedUser.status === FriendshipStatus.BLOCKED) {
        friendshipStatus = 'BLOCKED'; // Current user blocked searched user
      } else if (
        receivedFromSearchedUser &&
        receivedFromSearchedUser.status === FriendshipStatus.BLOCKED
      ) {
        friendshipStatus = 'BLOCKED'; // Searched user blocked current user
      } else if (sentToSearchedUser && sentToSearchedUser.status === FriendshipStatus.DECLINED) {
        friendshipStatus = 'DECLINED';
      } else if (
        receivedFromSearchedUser &&
        receivedFromSearchedUser.status === FriendshipStatus.DECLINED
      ) {
        friendshipStatus = 'DECLINED';
      }

      return {
        id: user.id,
        email: user.email,
        profile: user.profile,
        friendshipStatus,
      };
    });
  }
}

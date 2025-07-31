import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import { TripParticipant, TripParticipantRole } from '@prisma/client';

@Injectable()
export class TripParticipantRepository {
  private readonly logger = new Logger(TripParticipantRepository.name);

  constructor(private prisma: PrismaService) {}

  async addParticipant(
    tripId: string,
    userId: string,
    role: TripParticipantRole,
    prisma?: PrismaClientOrTransaction
  ): Promise<TripParticipant> {
    const client = prisma || this.prisma;
    
    try {
      return await client.tripParticipant.create({
        data: {
          tripId,
          userId,
          role,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to add participant to trip ${tripId}`, error);
      throw error;
    }
  }

  async removeParticipant(
    tripId: string,
    userId: string,
    prisma?: PrismaClientOrTransaction
  ): Promise<void> {
    const client = prisma || this.prisma;
    
    try {
      await client.tripParticipant.delete({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to remove participant from trip ${tripId}`, error);
      throw error;
    }
  }

  async updateParticipantRole(
    tripId: string,
    userId: string,
    role: TripParticipantRole,
    prisma?: PrismaClientOrTransaction
  ): Promise<TripParticipant> {
    const client = prisma || this.prisma;
    
    try {
      return await client.tripParticipant.update({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
        data: {
          role,
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update participant role in trip ${tripId}`, error);
      throw error;
    }
  }

  async findParticipantsByTripId(tripId: string): Promise<TripParticipant[]> {
    try {
      return await this.prisma.tripParticipant.findMany({
        where: { tripId },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // OWNER first, then EDITOR, then PARTICIPANT
          { createdAt: 'asc' },
        ],
      });
    } catch (error) {
      this.logger.error(`Failed to find participants for trip ${tripId}`, error);
      throw error;
    }
  }

  async findUserParticipatedTrips(userId: string): Promise<TripParticipant[]> {
    try {
      return await this.prisma.tripParticipant.findMany({
        where: { userId },
        include: {
          trip: {
            include: {
              stops: {
                include: {
                  location: true,
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Failed to find participated trips for user ${userId}`, error);
      throw error;
    }
  }

  async findParticipant(tripId: string, userId: string): Promise<TripParticipant | null> {
    try {
      return await this.prisma.tripParticipant.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to find participant in trip ${tripId} for user ${userId}`, error);
      throw error;
    }
  }

  async isUserParticipant(tripId: string, userId: string): Promise<boolean> {
    try {
      const participant = await this.prisma.tripParticipant.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
      });
      return !!participant;
    } catch (error) {
      this.logger.error(`Failed to check if user ${userId} is participant in trip ${tripId}`, error);
      throw error;
    }
  }

  async getUserRoleInTrip(tripId: string, userId: string): Promise<TripParticipantRole | null> {
    try {
      const participant = await this.prisma.tripParticipant.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId,
          },
        },
        select: {
          role: true,
        },
      });
      return participant?.role || null;
    } catch (error) {
      this.logger.error(`Failed to get user role in trip ${tripId} for user ${userId}`, error);
      throw error;
    }
  }
}
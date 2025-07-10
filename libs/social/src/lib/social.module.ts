import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import { FriendshipRepository } from './friendship.repository';

@Module({
  imports: [PrismaModule],
  controllers: [FriendshipController],
  providers: [FriendshipService, FriendshipRepository],
  exports: [FriendshipService, FriendshipRepository],
})
export class SocialModule {}

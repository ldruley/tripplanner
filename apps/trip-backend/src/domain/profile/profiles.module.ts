import { Module } from '@nestjs/common';
import { PrismaModule } from '@trip-planner/prisma';
import { ProfileService } from './services/profile.service';
import { ProfileRepository } from './repositories/profile.repository';
import { PrismaProfileRepository } from './repositories/prisma-profile.repository';
import { ProfileController } from './controllers/profile.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    {
      provide: ProfileRepository,
      useClass: PrismaProfileRepository,
    },
  ],
  exports: [ProfileService, ProfileRepository],
})
export class ProfilesModule {}

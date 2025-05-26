import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@trip-planner/prisma';

import {
  CreateProfile,
  UpdateProfile,
  Profile,
  ProfileQuery
} from '../../../../../libs/shared/types/src/schemas/profile.schema';

@Injectable()
export class UsersService {}

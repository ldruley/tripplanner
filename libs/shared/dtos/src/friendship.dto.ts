import { createZodDto } from '@anatine/zod-nestjs';
import {
  CreateFriendshipRequestSchema,
  UpdateFriendshipRequestSchema,
  FriendshipResponseSchema,
  FriendshipListResponseSchema,
  UserSearchResponseSchema,
} from '@trip-planner/types';

export class CreateFriendshipRequestDto extends createZodDto(CreateFriendshipRequestSchema) {}
export class UpdateFriendshipRequestDto extends createZodDto(UpdateFriendshipRequestSchema) {}
export class FriendshipResponseDto extends createZodDto(FriendshipResponseSchema) {}
export class FriendshipListResponseDto extends createZodDto(FriendshipListResponseSchema) {}
export class UserSearchResponseDto extends createZodDto(UserSearchResponseSchema) {}
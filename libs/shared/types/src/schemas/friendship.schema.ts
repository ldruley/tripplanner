import { z } from 'zod';
import { extendApi } from '@anatine/zod-openapi';
import { uuidSchema, createSuccessResponseSchema } from './base.schema';
import { FriendshipStatus } from '@prisma/client';

const friendshipStatusSchema = z.nativeEnum(FriendshipStatus).describe('Status of the friendship');

export const FriendshipSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the friendship'),
    senderId: uuidSchema.describe('ID of the user who sent the friend request'),
    receiverId: uuidSchema.describe('ID of the user who received the friend request'),
    status: friendshipStatusSchema,
    createdAt: z.date().describe('Timestamp when the friendship was created'),
    updatedAt: z.date().describe('Timestamp when the friendship was last updated'),
  }),
  {
    title: 'Friendship',
    description: 'Complete friendship entity',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      senderId: '550e8400-e29b-41d4-a716-446655440001',
      receiverId: '550e8400-e29b-41d4-a716-446655440002',
      status: 'PENDING',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  },
);

export const CreateFriendshipRequestSchema = extendApi(
  z.object({
    receiverId: uuidSchema.describe('ID of the user to send friend request to'),
  }),
  {
    title: 'Create Friendship Request',
    description: 'Schema for sending a friend request',
    example: {
      receiverId: '550e8400-e29b-41d4-a716-446655440002',
    },
  },
);

export const UpdateFriendshipRequestSchema = extendApi(
  z.object({
    status: friendshipStatusSchema.describe('New status for the friendship'),
  }),
  {
    title: 'Update Friendship Request',
    description: 'Schema for updating friendship status (accepting/declining)',
    example: {
      status: 'ACCEPTED',
    },
  },
);

export const FriendshipWithUsersSchema = extendApi(
  FriendshipSchema.extend({
    sender: z.object({
      id: uuidSchema,
      email: z.string().email(),
      profile: z
        .object({
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
        })
        .nullable(),
    }),
    receiver: z.object({
      id: uuidSchema,
      email: z.string().email(),
      profile: z
        .object({
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          displayName: z.string().nullable(),
          avatarUrl: z.string().nullable(),
        })
        .nullable(),
    }),
  }),
  {
    title: 'Friendship with Users',
    description: 'Friendship entity with related user information',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      senderId: '550e8400-e29b-41d4-a716-446655440001',
      receiverId: '550e8400-e29b-41d4-a716-446655440002',
      status: 'ACCEPTED',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      sender: {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'sender@example.com',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John D.',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      },
      receiver: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'receiver@example.com',
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'Jane S.',
          avatarUrl: 'https://example.com/avatar2.jpg',
        },
      },
    },
  },
);

export const UserSearchResultSchema = extendApi(
  z.object({
    id: uuidSchema.describe('User ID'),
    email: z.string().email().describe('User email address'),
    profile: z
      .object({
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        displayName: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      })
      .nullable(),
    friendshipStatus: z
      .enum(['NONE', 'PENDING_SENT', 'PENDING_RECEIVED', 'ACCEPTED', 'DECLINED', 'BLOCKED'])
      .describe('Current friendship status with the searching user'),
  }),
  {
    title: 'User Search Result',
    description: 'User search result with friendship status',
    example: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      email: 'user@example.com',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane S.',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      friendshipStatus: 'NONE',
    },
  },
);

export const FriendshipResponseSchema = extendApi(
  createSuccessResponseSchema(FriendshipSchema),
  {
    title: 'Friendship Response',
    description: 'Standard response schema for friendship operations',
    example: {
      success: true,
      data: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        senderId: '550e8400-e29b-41d4-a716-446655440001',
        receiverId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'ACCEPTED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      message: 'Friendship created successfully',
    },
  },
);

export const FriendshipListResponseSchema = extendApi(
  createSuccessResponseSchema(z.array(FriendshipWithUsersSchema)),
  {
    title: 'Friendship List Response',
    description: 'Standard response schema for friendship list operations',
    example: {
      success: true,
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          senderId: '550e8400-e29b-41d4-a716-446655440001',
          receiverId: '550e8400-e29b-41d4-a716-446655440002',
          status: 'ACCEPTED',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          sender: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'sender@example.com',
            profile: {
              firstName: 'John',
              lastName: 'Doe',
              displayName: 'John D.',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
          },
          receiver: {
            id: '550e8400-e29b-41d4-a716-446655440002',
            email: 'receiver@example.com',
            profile: {
              firstName: 'Jane',
              lastName: 'Smith',
              displayName: 'Jane S.',
              avatarUrl: 'https://example.com/avatar2.jpg',
            },
          },
        },
      ],
      message: 'Friendships retrieved successfully',
    },
  },
);

export const UserSearchResponseSchema = extendApi(
  createSuccessResponseSchema(z.array(UserSearchResultSchema)),
  {
    title: 'User Search Response',
    description: 'Standard response schema for user search operations',
    example: {
      success: true,
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          email: 'user@example.com',
          profile: {
            firstName: 'Jane',
            lastName: 'Smith',
            displayName: 'Jane S.',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          friendshipStatus: 'NONE',
        },
      ],
      message: 'Users found successfully',
    },
  },
);

export type Friendship = z.infer<typeof FriendshipSchema>;
export type CreateFriendshipRequest = z.infer<typeof CreateFriendshipRequestSchema>;
export type UpdateFriendshipRequest = z.infer<typeof UpdateFriendshipRequestSchema>;
export type FriendshipWithUsers = z.infer<typeof FriendshipWithUsersSchema>;
export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type FriendshipResponse = z.infer<typeof FriendshipResponseSchema>;
export type FriendshipListResponse = z.infer<typeof FriendshipListResponseSchema>;
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

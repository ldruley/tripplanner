import { 
  UserFavoriteLocation, 
  CreateUserFavoriteLocation, 
  UpdateUserFavoriteLocation 
} from '@trip-planner/types';

/**
 * Base Command interface for all location domain commands
 * Commands represent an intent to perform a write operation
 */
export interface Command<TResult = void> {
  readonly type: string;
}

/**
 * Command to create a new user favorite location
 */
export interface CreateFavoriteLocationCommand extends Command<UserFavoriteLocation> {
  readonly type: '[Location] Create Favorite';
  readonly payload: CreateUserFavoriteLocation;
}

/**
 * Command to update an existing user favorite location
 */
export interface UpdateFavoriteLocationCommand extends Command<UserFavoriteLocation> {
  readonly type: '[Location] Update Favorite';
  readonly payload: {
    favoriteId: string;
    updates: UpdateUserFavoriteLocation;
  };
}

/**
 * Command to delete a user favorite location
 */
export interface DeleteFavoriteLocationCommand extends Command<void> {
  readonly type: '[Location] Delete Favorite';
  readonly payload: {
    favoriteId: string;
  };
}
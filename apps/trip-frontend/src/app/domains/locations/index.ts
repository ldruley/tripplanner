// Main facade
export { LocationFacade } from './location.facade';

// Query types
export {
  Query,
  SearchLocationsQuery,
  SearchByAddressQuery,
  SearchByPlaceQuery,
  GetUserFavoritesQuery,
  GetFavoriteByIdQuery,
} from './queries/location-queries';

// Command types
export {
  Command,
  CreateFavoriteLocationCommand,
  UpdateFavoriteLocationCommand,
  DeleteFavoriteLocationCommand,
} from './commands/location-commands';

// Services (typically not exported, but available if needed)
export { LocationQueryService } from './services/location-query.service';
export { LocationCommandService } from './services/location-command.service';
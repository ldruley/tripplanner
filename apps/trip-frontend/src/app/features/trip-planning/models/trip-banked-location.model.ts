import { TripBankedLocation as SharedTripBankedLocation } from '@trip-planner/types';

interface Extras {
  tempClientId?: string; // For temporary client-side identification
}

export type TripBankedLocation = SharedTripBankedLocation & Extras;
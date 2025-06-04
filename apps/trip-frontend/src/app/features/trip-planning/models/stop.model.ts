import { Stop as SharedStop } from '@trip-planner/types';

interface Extras {
  tempClientId?: string; // For temporary client-side identification
}

export type Stop = SharedStop & Extras;

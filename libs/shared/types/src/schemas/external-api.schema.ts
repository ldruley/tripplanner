import { z } from 'zod';

export type HereBaseFeature = {
  position?: { lat: number; lng: number };
  address?: {
    label?: string;
    houseNumber?: string;
    street?: string;
    countryName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    county?: string; // Added based on example
    district?: string; // Added based on example
    countryCode?: string; // Added based on example
    stateCode?: string; // Added based on example
    countyCode?: string; // Added based on example
    [key: string]: unknown;
  };
  title?: string;
  id?: string;
  timeZone?: {
    name?: string;
    offset?: number; // offset in seconds from UTC
    utcOffset?: string; // Added based on example
    [key: string]: unknown;
  };
  mapView?: {
    // Added based on example
    west?: number;
    south?: number;
    east?: number;
    north?: number;
    [key: string]: unknown;
  };
  scoring?: {
    // Added based on example
    queryScore?: number;
    fieldScore?: {
      streets?: number[];
      houseNumber?: number;
      city?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  access?: Array<{ lat: number; lng: number }>; // Added based on example
  [key: string]: unknown;
};

export type HerePlaceCategory = {
  id: string;
  name: string;
  primary?: boolean;
  [key: string]: unknown;
};

export type HereFoodType = {
  id: string;
  name: string;
  primary?: boolean;
  [key: string]: unknown;
};

export type HereContact = {
  phone?: Array<{ value: string }>;
  mobile?: Array<{ value: string; categories?: HerePlaceCategory[] }>;
  www?: Array<{ value: string; categories?: HerePlaceCategory[] }>;
  email?: Array<{ value: string; categories?: HerePlaceCategory[] }>;
  [key: string]: unknown;
};

export type HereOpeningHours = {
  text?: string[];
  isOpen?: boolean;
  structured?: Array<{
    start: string;
    duration: string;
    recurrence: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type HereReference = {
  supplier: { id: string };
  id: string;
  [key: string]: unknown;
};

export type HerePlaceFeature = HereBaseFeature & {
  name?: string;
  resultType: 'place';
  language?: string;
  categories?: HerePlaceCategory[];
  foodTypes?: HereFoodType[];
  contacts?: HereContact[];
  openingHours?: HereOpeningHours[];
  chains?: unknown[]; // Placeholder for chain metadata
  accessRestriction?: unknown[]; // Placeholder for access restriction info
  references?: HereReference[];
};

export type HereHouseNumberFeature = HereBaseFeature & {
  resultType: 'houseNumber';
  houseNumberType?: string;
};

export type HereLocalityFeature = HereBaseFeature & {
  resultType: 'locality';
  localityType?: string;
};

export type HerePoiApiResponse = {
  items: HerePlaceFeature[];
};

export type HereGeocodeApiResponse = {
  items: Array<HerePlaceFeature | HereHouseNumberFeature | HereLocalityFeature>;
};

export type MapboxCoordinates = {
  latitude?: number;
  longitude?: number;
  accuracy?: string;
  routable_points?: Array<{ name?: string; latitude?: number; longitude?: number }>;
  [key: string]: unknown;
};

export type MapboxContextItem = {
  id?: string;
  name?: string;
  wikidata_id?: string;
  country_code?: string;
  country_code_alpha_3?: string;
  region_code?: string;
  region_code_full?: string;
  address_number?: string;
  street_name?: string;
  designator?: string; // For secondary_address
  identifier?: string; // For secondary_address
  extrapolated?: boolean; // For secondary_address
  [key: string]: unknown;
};

export type MapboxContext = {
  country?: MapboxContextItem;
  region?: MapboxContextItem;
  postcode?: MapboxContextItem;
  district?: MapboxContextItem;
  place?: MapboxContextItem;
  locality?: MapboxContextItem;
  neighborhood?: MapboxContextItem;
  street?: MapboxContextItem;
  address?: MapboxContextItem;
  secondary_address?: MapboxContextItem;
  [key: string]: unknown;
};

export type BaseMapboxProperties = {
  name?: string;
  mapbox_id?: string;
  feature_type?: string;
  address?: string;
  full_address?: string;
  place_formatted?: string;
  context?: MapboxContext;
  coordinates?: MapboxCoordinates;
  language?: string;
  maki?: string;
  external_ids?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  name_preferred?: string;
  bbox?: [number, number, number, number];
  match_code?: unknown; // Placeholder for match_code
  [key: string]: unknown;
};

export type MapboxPoiFeature = {
  type: 'Feature';
  geometry?: {
    coordinates?: [number, number]; // [longitude, latitude]
    type?: 'Point';
  };
  properties?: BaseMapboxProperties;
  provider: string;
  [key: string]: unknown;
};

export type MapboxPoiApiResponse = {
  type: 'FeatureCollection';
  features: MapboxPoiFeature[];
  attribution: string;
};

export type MapboxGeocodeFeature = {
  type: 'Feature';
  geometry?: {
    coordinates?: [number, number]; // [longitude, latitude]
    type?: 'Point';
  };
  properties?: BaseMapboxProperties;
  provider: string;
  id?: string;
  [key: string]: unknown;
};

export type MapboxGeocodeApiResponse = {
  type: 'FeatureCollection';
  features: MapboxGeocodeFeature[];
  attribution: string;
  [key: string]: unknown;
};

export type GenericApiResponse = {
  [key: string]: unknown;
};

// HERE Routing API v8 Response Types
export type HereRoutingV8Summary = {
  length: number; // meters
  duration: number; // seconds
  baseDuration?: number; // seconds
  [key: string]: unknown;
};

export type HereRoutingV8Place = {
  type: string;
  location: {
    lat: number;
    lng: number;
  };
  originalLocation: {
    lat: number;
    lng: number;
  };
  [key: string]: unknown;
};

export type HereRoutingV8Section = {
  id: string;
  type: string;
  departure: {
    time: string;
    place: HereRoutingV8Place;
  };
  arrival: {
    time: string;
    place: HereRoutingV8Place;
  };
  summary: HereRoutingV8Summary;
  polyline: string;
  transport: {
    mode: string;
  };
  [key: string]: unknown;
};

export type HereRoutingV8Route = {
  id: string;
  sections: HereRoutingV8Section[];
  [key: string]: unknown;
};

export type HereRoutingApiResponse = {
  routes: HereRoutingV8Route[];
  [key: string]: unknown;
};

// Mapbox Routing API Response Types
export type MapboxRoutingWaypoint = {
  location: [number, number]; // [longitude, latitude]
  name?: string;
  [key: string]: unknown;
};

export type MapboxRoutingLeg = {
  distance: number; // meters
  duration: number; // seconds
  summary?: string;
  geometry?: string; // polyline for this specific leg
  [key: string]: unknown;
};

export type MapboxRoutingRoute = {
  distance: number; // meters
  duration: number; // seconds
  geometry: string; // polyline
  legs: MapboxRoutingLeg[];
  waypoint_order?: number[];
  [key: string]: unknown;
};

export type MapboxRoutingApiResponse = {
  routes: MapboxRoutingRoute[];
  waypoints: MapboxRoutingWaypoint[];
  code: string;
  [key: string]: unknown;
};

export const HereExtendedDataSchema = z
  .object({
    resultType: z
      .union([z.literal('place'), z.literal('houseNumber'), z.literal('locality')])
      .optional(),
    language: z.string().optional(),
    categories: z
      .array(
        z.lazy(() =>
          z.object({ id: z.string(), name: z.string(), primary: z.boolean().optional() }),
        ),
      )
      .optional(),
    foodTypes: z
      .array(
        z.lazy(() =>
          z.object({ id: z.string(), name: z.string(), primary: z.boolean().optional() }),
        ),
      )
      .optional(),
    contacts: z.array(z.any()).optional(), // Keeping any for complex nested structures to avoid over-engineering
    openingHours: z.array(z.any()).optional(),
    chains: z.array(z.any()).optional(),
    accessRestriction: z.array(z.any()).optional(),
    references: z.array(z.any()).optional(),
    houseNumberType: z.string().optional(),
    localityType: z.string().optional(),
    mapView: z.any().optional(), // Represents the full MapView object
    scoring: z.any().optional(), // Represents the full Scoring object
    access: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(), // Array of access points
    timezoneOffset: z.number().optional(), // Offset from UTC in seconds
    timezoneUtcOffset: z.string().optional(), // UTC offset string
    // Additional address components not directly mapped to Location fields
    countryCode: z.string().optional(),
    stateCode: z.string().optional(),
    county: z.string().optional(),
    countyCode: z.string().optional(),
    district: z.string().optional(),
    placeName: z.string().optional(), // For HerePlaceFeature.name if it differs from top-level name
  })
  .passthrough(); // Allow additional unknown properties if present

export type HereExtendedData = z.infer<typeof HereExtendedDataSchema>;

// Specific extended data for Mapbox API responses
export const MapboxExtendedDataSchema = z
  .object({
    geometry: z
      .object({
        coordinates: z.array(z.number()).length(2).optional(), // [longitude, latitude]
        type: z.literal('Point').optional(),
      })
      .optional(),
    mapboxFeatureType: z.string().optional(), // Renamed to avoid collision with GeoJSON 'type'
    placeFormatted: z.string().optional(),
    maki: z.string().optional(),
    externalIds: z.record(z.any()).optional(), // Dictionary of external IDs
    metadata: z.record(z.any()).optional(), // Dictionary for metadata
    namePreferred: z.string().optional(),
    bbox: z.array(z.number()).length(4).optional(), // [minLon, minLat, maxLon, maxLat]
    matchCode: z.any().optional(), // Can be complex
    context: z.any().optional(), // Store the entire context object for detailed info
    coordinatesAccuracy: z.string().optional(),
    coordinatesRoutablePoints: z.array(z.any()).optional(),
    // Specific context fields if needed
    countryCode: z.string().optional(),
    countryCodeAlpha3: z.string().optional(),
    regionCode: z.string().optional(),
    regionCodeFull: z.string().optional(),
    postcodeContextId: z.string().optional(),
    districtContext: z.any().optional(),
    neighborhoodContext: z.any().optional(),
    addressContextId: z.string().optional(),
    addressContextName: z.string().optional(),
    streetContextId: z.string().optional(),
    secondaryAddressContext: z.any().optional(),
  })
  .passthrough(); // Allow additional unknown properties if present

export type MapboxExtendedData = z.infer<typeof MapboxExtendedDataSchema>;

// Unified schema for the `extendedData` JSON field in the Location model.
// This allows `extendedData` to hold either HERE or Mapbox specific additional data.
export const LocationExtendedDataSchema = z
  .union([HereExtendedDataSchema, MapboxExtendedDataSchema])
  .nullable()
  .optional();

export type LocationExtendedData = HereExtendedData | MapboxExtendedData | null | undefined;
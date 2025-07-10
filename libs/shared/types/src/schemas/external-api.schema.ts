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
    [key: string]: unknown;
  };
  title?: string;
  id?: string;
  timezone?: {
    name?: string;
    offset?: number; // offset in seconds from UTC
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type HerePoiFeature = HereBaseFeature & {
  name?: string;
};

export type HerePoiApiResponse = {
  items: HerePoiFeature[];
};

export type HereGeocodeApiResponse = {
  items: HereBaseFeature[];
};

export type BaseMapboxProperties = {
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  full_address?: string;
  name?: string;
  address?: string;
  mapbox_id?: string;
  context?: {
    country?: { name?: string };
    place?: { name?: string };
    region?: { name?: string };
    postcode?: { name?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MapboxPoiFeature = {
  properties?: BaseMapboxProperties;
  provider: string;
  [key: string]: unknown;
};

export type MapboxPoiApiResponse = {
  features: MapboxPoiFeature[];
};

export type MapboxGeocodeFeature = {
  properties?: BaseMapboxProperties;
  provider: string;
  [key: string]: unknown;
};

export type MapboxGeocodeApiResponse = {
  features: MapboxGeocodeFeature[];
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

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

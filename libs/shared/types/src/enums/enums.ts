
export enum TravelMode {
  'DRIVING',
  'WALKING',
  'BICYCLING',
  'TRANSIT',
  'PUBLIC_TRANSPORT'
}

export enum UserRole {
  'user',
  'admin',
  'moderator'
}

export enum UserStatus {
  'active',
  'suspended',
  'pending'
}

export enum ApiSourceProvider {
  'GOOGLE_PLACES',
  'FOURSQUARE',
  'OPENSTREETMAP',
  'HERE',
  'MAPBOX',
  'USER_INPUT',
  'INTERNAL_SEED'
}

export enum LocationCategory {
  'RESTAURANT',
  'CAFE',
  'HOTEL',
  'ACCOMMODATION',
  'LANDMARK',
  'POINT_OF_INTEREST',
  'TRANSPORT_HUB',
  'SHOPPING',
  'NATURE',
  'MUSEUM',
  'PARK',
  'HISTORICAL_SITE',
  'ENTERTAINMENT',
  'OTHER',
}

export enum DistanceUnit {
  'MILES',
  'KILOMETERS'
}

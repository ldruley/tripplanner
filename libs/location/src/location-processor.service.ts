// libs/location/src/location-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  HerePlaceFeature,
  HereHouseNumberFeature,
  HereLocalityFeature,
  MapboxPoiFeature,
  MapboxGeocodeFeature,
  MapboxContextItem,
  HereExtendedData,
  MapboxExtendedData,
} from '@trip-planner/types';
import { ApiSourceProvider } from '@prisma/client';

@Injectable()
export class LocationProcessorService {
  private readonly logger = new Logger(LocationProcessorService.name);
  processHereFeature(
    feature: HerePlaceFeature | HereHouseNumberFeature | HereLocalityFeature,
  ): Prisma.LocationCreateInput {
    // Determine the name: prioritize HerePlaceFeature's 'name', then 'title', then 'address.label'
    let name: string = feature.title || feature.address?.label || 'Unnamed Location';
    if (feature.resultType === 'place' && (feature as HerePlaceFeature).name) {
      name = (feature as HerePlaceFeature).name as string;
    }

    const timezoneValue = feature.timeZone?.name;
    this.logger.debug(`HERE timezone data: ${JSON.stringify(feature.timeZone)} -> extracted: "${timezoneValue}" for ${name}`);

    const commonData: Prisma.LocationCreateInput = {
      name: name,
      latitude: feature.position?.lat as number,
      longitude: feature.position?.lng as number,
      address: feature.address?.label,
      houseNumber: feature.address?.houseNumber, // Mapped directly
      city: feature.address?.city,
      state: feature.address?.state,
      country: feature.address?.countryName,
      postalCode: feature.address?.postalCode,
      apiSource: ApiSourceProvider.HERE,
      apiSourceId: feature.id as string,
      timezone: timezoneValue,
      category: null, // Default or derive from HerePlaceFeature.categories
      public: false,
    };

    const extendedData: HereExtendedData = {
      resultType: feature.resultType,
      mapView: feature.mapView,
      scoring: feature.scoring,
      access: feature.access,
      timezoneOffset: feature.timeZone?.offset,
      timezoneUtcOffset: feature.timeZone?.utcOffset,
      // Add more specific address components to extendedData if not in commonData
      countryCode: feature.address?.countryCode,
      stateCode: feature.address?.stateCode,
      county: feature.address?.county,
      countyCode: feature.address?.countyCode,
      district: feature.address?.district,
    };

    // Add fields specific to HerePlaceFeature to extendedData
    if (feature.resultType === 'place') {
      const placeFeature = feature as HerePlaceFeature;
      extendedData.language = placeFeature.language;
      extendedData.categories = placeFeature.categories;
      extendedData.foodTypes = placeFeature.foodTypes;
      extendedData.contacts = placeFeature.contacts;
      extendedData.openingHours = placeFeature.openingHours;
      extendedData.chains = placeFeature.chains;
      extendedData.accessRestriction = placeFeature.accessRestriction;
      extendedData.references = placeFeature.references;
      // 'placeName' is set here if different from general name
      if (placeFeature.name && placeFeature.name !== commonData.name) {
        extendedData.placeName = placeFeature.name;
      }
    } else if (feature.resultType === 'houseNumber') {
      const houseNumberFeature = feature as HereHouseNumberFeature;
      extendedData.houseNumberType = houseNumberFeature.houseNumberType;
    } else if (feature.resultType === 'locality') {
      const localityFeature = feature as HereLocalityFeature;
      extendedData.localityType = localityFeature.localityType;
    }

    return { ...commonData, extendedData: extendedData as Prisma.InputJsonValue };
  }

  processMapboxFeature(
    feature: MapboxPoiFeature | MapboxGeocodeFeature,
  ): Prisma.LocationCreateInput {
    const properties = feature.properties;

    // Helper to get context item name safely
    const getContextName = (contextItem?: MapboxContextItem) => contextItem?.name;

    const commonData: Prisma.LocationCreateInput = {
      name: properties?.name || properties?.full_address || 'Unnamed Location',
      latitude: properties?.coordinates?.latitude as number,
      longitude: properties?.coordinates?.longitude as number,
      address: properties?.full_address, // Mapbox's full_address maps to 'address'
      houseNumber: properties?.context?.address?.address_number, // Mapped directly
      city: getContextName(properties?.context?.place),
      state: getContextName(properties?.context?.region),
      country: getContextName(properties?.context?.country),
      postalCode: getContextName(properties?.context?.postcode),
      apiSource: ApiSourceProvider.MAPBOX,
      apiSourceId: properties?.mapbox_id as string,
      timezone: null, // Mapbox Geocode API does not directly provide timezone name
      category: null, // Placeholder
      public: false,
    };

    const extendedData: MapboxExtendedData = {
      geometry: feature.geometry,
      mapboxFeatureType: properties?.feature_type,
      placeFormatted: properties?.place_formatted,
      maki: properties?.maki,
      externalIds: properties?.external_ids,
      metadata: properties?.metadata,
      namePreferred: properties?.name_preferred,
      bbox: properties?.bbox,
      matchCode: properties?.match_code,
      context: properties?.context, // Store the entire context object
      coordinatesAccuracy: properties?.coordinates?.accuracy,
      coordinatesRoutablePoints: properties?.coordinates?.routable_points,
    };

    // Add more granular context details to extendedData if needed,
    // avoiding duplication with main Location fields
    if (properties?.context?.country) {
      extendedData.countryCode = properties.context.country.country_code;
      extendedData.countryCodeAlpha3 = properties.context.country.country_code_alpha_3;
    }
    if (properties?.context?.region) {
      extendedData.regionCode = properties.context.region.region_code;
      extendedData.regionCodeFull = properties.context.region.region_code_full;
    }
    if (properties?.context?.postcode) {
      extendedData.postcodeContextId = properties.context.postcode.id;
    }
    if (properties?.context?.district) {
      extendedData.districtContext = properties.context.district;
    }
    if (properties?.context?.neighborhood) {
      extendedData.neighborhoodContext = properties.context.neighborhood;
    }
    if (properties?.context?.address) {
      if (properties.context.address.id)
        extendedData.addressContextId = properties.context.address.id;
      if (
        properties.context.address.name &&
        properties.context.address.name !== commonData.address
      ) {
        extendedData.addressContextName = properties.context.address.name;
      }
    }
    if (properties?.context?.street) {
      extendedData.streetContextId = properties.context.street.id;
    }
    if (properties?.context?.secondary_address) {
      extendedData.secondaryAddressContext = properties.context.secondary_address;
    }

    return { ...commonData, extendedData: extendedData as Prisma.InputJsonValue };
  }
}

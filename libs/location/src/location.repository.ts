import { Injectable } from '@nestjs/common';
import { PrismaService, PrismaClientOrTransaction } from '@trip-planner/prisma';
import {
  Location,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationSearchCriteria,
} from '@trip-planner/types';
import {} from './location.types';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new location
   * @param data - Location creation data
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Created Location
   */
  async create(
    data: CreateLocationRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    const client = prismaClient || this.prisma;

    const location = await client.location.create({
      data: {
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        postalCode: data.postalCode,
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        apiSource: data.apiSource || null,
        apiSourceId: data.apiSourceId || null,
        category: data.category || null,
        public: data.public || false,
      },
    });

    return location as Location;
  }

  /**
   * Find a location by its ID
   * @param id - Location ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Found Location or null if not found
   */
  async findById(id: string, prismaClient?: PrismaClientOrTransaction): Promise<Location | null> {
    const client = prismaClient || this.prisma;

    const location = await client.location.findUnique({
      where: { id },
    });

    return location as Location | null;
  }

  /**
   * Find locations by coordinates within a specified radius
   * @param latitude - Latitude of the center point
   * @param longitude - Longitude of the center point
   * @param radiusMeters - Radius in meters
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Locations within the radius
   */
  async findByCoordinates(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    // Calculate approximate coordinate bounds for the radius
    // 1 degree latitude ≈ 111,000 meters
    // 1 degree longitude ≈ 111,000 * cos(latitude) meters
    const latDelta = radiusMeters / 111000;
    const lngDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180));

    const locations = await client.location.findMany({
      where: {
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta,
        },
        longitude: {
          gte: longitude - lngDelta,
          lte: longitude + lngDelta,
        },
      },
    });

    // Filter by actual distance using Haversine formula
    return locations.filter(location => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude,
      );
      return distance <= radiusMeters;
    }) as Location[];
  }

  async findByNameAndAddress(
    name: string,
    address?: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    const whereClause: any = {
      name: {
        contains: name,
        mode: 'insensitive',
      },
    };

    if (address) {
      whereClause.OR = [
        {
          address: {
            contains: address,
            mode: 'insensitive',
          },
        },
        {
          city: {
            contains: address,
            mode: 'insensitive',
          },
        },
      ];
    }

    const locations = await client.location.findMany({
      where: whereClause,
    });

    return locations as Location[];
  }

  /**
   * Find locations by exact coordinates
   * @param latitude
   * @param longitude
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async findByExactCoordinates(
    latitude: number,
    longitude: number,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    const locations = await client.location.findMany({
      where: {
        latitude: latitude,
        longitude: longitude,
      },
    });

    return locations as Location[];
  }

  /**
   * Find locations by API source and ID
   * @param apiSource - API source identifier
   * @param apiSourceId - API source specific ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   */
  async findByApiSourceId(
    apiSource: string,
    apiSourceId: string,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    const locations = await client.location.findMany({
      where: {
        apiSource: apiSource as any,
        apiSourceId: apiSourceId,
      },
    });

    return locations as Location[];
  }

  /**
   * Search locations based on various criteria
   * @param criteria - LocationSearchCriteria
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Locations matching the criteria
   */
  async search(
    criteria: LocationSearchCriteria,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    const whereClause: any = {};

    if (criteria.name) {
      whereClause.name = {
        contains: criteria.name,
        mode: 'insensitive',
      };
    }

    if (criteria.city) {
      whereClause.city = {
        contains: criteria.city,
        mode: 'insensitive',
      };
    }

    if (criteria.state) {
      whereClause.state = {
        contains: criteria.state,
        mode: 'insensitive',
      };
    }

    if (criteria.country) {
      whereClause.country = {
        contains: criteria.country,
        mode: 'insensitive',
      };
    }

    if (criteria.public !== undefined) {
      whereClause.public = criteria.public;
    }

    if (criteria.apiSource) {
      whereClause.apiSource = criteria.apiSource as any;
    }

    if (criteria.category) {
      whereClause.category = criteria.category as any;
    }

    let locations = await client.location.findMany({
      where: whereClause,
    });

    // Filter by coordinates if provided
    if (criteria.coordinates) {
      locations = locations.filter(location => {
        const distance = this.calculateDistance(
          criteria.coordinates!.latitude,
          criteria.coordinates!.longitude,
          location.latitude,
          location.longitude,
        );
        return distance <= criteria.coordinates!.radius;
      });
    }

    return locations as Location[];
  }

  /**
   * Update an existing location
   * @param id - Location ID
   * @param data - UpdateLocationRequest
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Updated Location
   */
  async update(
    id: string,
    data: UpdateLocationRequest,
    prismaClient?: PrismaClientOrTransaction,
  ): Promise<Location> {
    const client = prismaClient || this.prisma;

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.apiSource !== undefined) updateData.apiSource = data.apiSource as any;
    if (data.apiSourceId !== undefined) updateData.apiSourceId = data.apiSourceId;
    if (data.category !== undefined) updateData.category = data.category as any;
    if (data.public !== undefined) updateData.public = data.public;

    const location = await client.location.update({
      where: { id },
      data: updateData,
    });

    return location as Location;
  }

  /**
   * Delete a location by ID
   * @param id - Location ID
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Promise<void>
   */
  async delete(id: string, prismaClient?: PrismaClientOrTransaction): Promise<void> {
    const client = prismaClient || this.prisma;

    await client.location.delete({
      where: { id },
    });
  }

  /**
   * Find all locations, ordered by creation date
   * @param prismaClient - Optional Prisma client for testing or custom transactions
   * @returns Array of Locations
   */
  async findAll(prismaClient?: PrismaClientOrTransaction): Promise<Location[]> {
    const client = prismaClient || this.prisma;

    const locations = await client.location.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return locations as Location[];
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   * @param lat1 - Latitude of first point
   * @param lng1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lng2 - Longitude of second point
   * @return Distance in metersg
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

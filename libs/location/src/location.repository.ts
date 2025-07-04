import { Injectable } from '@nestjs/common';
import { PrismaService } from '@trip-planner/prisma';
import { Location } from '@trip-planner/types';
import { CreateLocationRequest, UpdateLocationRequest, LocationSearchCriteria } from './location.types';

@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLocationRequest): Promise<Location> {
    const location = await this.prisma.location.create({
      data: {
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        postalCode: data.postalCode || null,
        latitude: data.latitude,
        longitude: data.longitude,
        apiSource: data.apiSource as any || null,
        apiSourceId: data.apiSourceId || null,
        category: data.category as any || null,
        public: data.public || false,
      },
    });

    return location as Location;
  }

  async findById(id: string): Promise<Location | null> {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });

    return location as Location | null;
  }

  async findByCoordinates(latitude: number, longitude: number, radiusMeters: number): Promise<Location[]> {
    // Calculate approximate coordinate bounds for the radius
    // 1 degree latitude ≈ 111,000 meters
    // 1 degree longitude ≈ 111,000 * cos(latitude) meters
    const latDelta = radiusMeters / 111000;
    const lngDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180));

    const locations = await this.prisma.location.findMany({
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
      const distance = this.calculateDistance(latitude, longitude, location.latitude, location.longitude);
      return distance <= radiusMeters;
    }) as Location[];
  }

  async findByNameAndAddress(name: string, address?: string): Promise<Location[]> {
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

    const locations = await this.prisma.location.findMany({
      where: whereClause,
    });

    return locations as Location[];
  }

  async findByExactCoordinates(latitude: number, longitude: number): Promise<Location[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        latitude: latitude,
        longitude: longitude,
      },
    });

    return locations as Location[];
  }

  async findByApiSourceId(apiSource: string, apiSourceId: string): Promise<Location[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        apiSource: apiSource as any,
        apiSourceId: apiSourceId,
      },
    });

    return locations as Location[];
  }

  async search(criteria: LocationSearchCriteria): Promise<Location[]> {
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

    let locations = await this.prisma.location.findMany({
      where: whereClause,
    });

    // Filter by coordinates if provided
    if (criteria.coordinates) {
      locations = locations.filter(location => {
        const distance = this.calculateDistance(
          criteria.coordinates!.latitude,
          criteria.coordinates!.longitude,
          location.latitude,
          location.longitude
        );
        return distance <= criteria.coordinates!.radius;
      });
    }

    return locations as Location[];
  }

  async update(id: string, data: UpdateLocationRequest): Promise<Location> {
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

    const location = await this.prisma.location.update({
      where: { id },
      data: updateData,
    });

    return location as Location;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.location.delete({
      where: { id },
    });
  }

  async findAll(): Promise<Location[]> {
    const locations = await this.prisma.location.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return locations as Location[];
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class SharedValidationService {
  /**
   * Validate that organized locations have proper sequential ordering.
   * Consolidates validation logic from multiple services.
   * @param organizedLocations - List of organized locations to validate.
   */
  validateOrganizedLocations(
    organizedLocations: {
      order: number;
      name: string;
      latitude: number;
      longitude: number;
    }[],
  ): void {
    if (organizedLocations.length === 0) {
      throw new BadRequestException('At least one location is required');
    }

    // Check for duplicate orders
    const orders = organizedLocations.map(loc => loc.order);
    const uniqueOrders = [...new Set(orders)];

    if (orders.length !== uniqueOrders.length) {
      throw new BadRequestException('Duplicate order values found in organized locations');
    }

    // Check for sequential ordering starting from 0
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);

    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i) {
        throw new BadRequestException(
          `Invalid ordering: expected order ${i} but found ${sortedOrders[i]}. Orders must be sequential starting from 0.`,
        );
      }
    }

    // Validate required fields
    for (const location of organizedLocations) {
      if (!location.name || location.name.trim() === '') {
        throw new BadRequestException('All locations must have a name');
      }

      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new BadRequestException('All locations must have valid coordinates');
      }

      if (location.latitude < -90 || location.latitude > 90) {
        throw new BadRequestException('Latitude must be between -90 and 90');
      }

      if (location.longitude < -180 || location.longitude > 180) {
        throw new BadRequestException('Longitude must be between -180 and 180');
      }
    }
  }

  /**
   * Validate stop orders for reordering operations.
   * Consolidates validation logic from StopCoordinationService.
   * @param stopOrders - Stop orders to validate.
   */
  validateStopOrders(stopOrders: { newOrder: number }[]): void {
    if (stopOrders.length === 0) {
      throw new BadRequestException('At least one stop order is required');
    }

    // Check for duplicate orders
    const orders = stopOrders.map(so => so.newOrder);
    const uniqueOrders = [...new Set(orders)];

    if (orders.length !== uniqueOrders.length) {
      throw new BadRequestException('Duplicate order values found in stop orders');
    }

    // Check for sequential ordering starting from 0
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);

    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i) {
        throw new BadRequestException(
          `Invalid ordering: expected order ${i} but found ${sortedOrders[i]}. Orders must be sequential starting from 0.`,
        );
      }
    }
  }

  /**
   * Validate coordinates are within valid ranges.
   * @param latitude - Latitude to validate.
   * @param longitude - Longitude to validate.
   */
  validateCoordinates(latitude: number, longitude: number): void {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new BadRequestException('Coordinates must be valid numbers');
    }

    if (latitude < -90 || latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }
  }
}
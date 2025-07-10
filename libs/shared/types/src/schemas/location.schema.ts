import { z } from 'zod';
import { latitudeSchema, longitudeSchema, uuidSchema } from './base.schema';
import { ApiSourceProvider, LocationCategory, Prisma } from '@prisma/client';
import { extendApi } from '@anatine/zod-openapi';

export const LocationCategorySchema = z.nativeEnum(LocationCategory);
export const ApiSourceSchema = z.nativeEnum(ApiSourceProvider);

export const LocationSchema = extendApi(
  z.object({
    id: uuidSchema.describe('Unique identifier for the location'),
    name: z
      .string()
      .min(1, { message: 'Name is required and must be at least 1 character' })
      .describe('Name of the location'),
    description: z.string().nullable().optional().describe('Optional description of the location'),

    // Address fields to match Prisma
    address: z.string().nullable().optional().describe('Street address of the location'),
    city: z.string().nullable().optional().describe('City where the location is situated'),
    state: z.string().nullable().optional().describe('State or region of the location'),
    country: z.string().nullable().optional().describe('Country of the location'),
    postalCode: z.string().nullable().optional().describe('Postal or ZIP code of the location'),

    // Location coordinates
    latitude: latitudeSchema.describe('Latitude coordinate of the location'),
    longitude: longitudeSchema.describe('Longitude coordinate of the location'),

    // Timezone information
    timezone: z.string().nullable().optional().describe('Timezone of the location'),

    // API source and category
    apiSource: ApiSourceSchema.nullable()
      .optional()
      .describe('Source provider of the location data'),
    apiSourceId: z.string().nullable().optional().describe('ID of the location in the source API'),
    extendedData: z
      .any()
      .nullable()
      .optional()
      .describe('Raw API data for the location (temporary field)'),
    category: LocationCategorySchema.nullable()
      .optional()
      .describe('Category of the location (e.g., attraction, restaurant)'),

    // Public flag for sharing
    public: z.boolean().default(false).describe('Whether the location is publicly visible'),

    // Standard database timestamps
    createdAt: z.coerce.date().describe('Timestamp when the location was created'),
    updatedAt: z.coerce.date().describe('Timestamp when the location was last updated'),
  }),
  {
    title: 'Location',
    description: 'Represents a physical location with address and coordinates.',
    example: {
      id: 'b7e23ec29af22b0b4e41da31e868d572',
      name: 'Eiffel Tower',
      description: 'Iconic iron lattice tower in Paris',
      address: 'Champ de Mars, 5 Avenue Anatole France',
      city: 'Paris',
      state: 'Île-de-France',
      country: 'France',
      postalCode: '75007',
      latitude: 48.8584,
      longitude: 2.2945,
      timezone: 'Europe/Paris',
      apiSource: 'HERE',
      apiSourceId: 'here:pds:place:250jx7ps-b9d7fc1d8dbc4dd9adb39e4b7cf0b2f7',
      extendedData: null,
      category: 'ATTRACTION',
      public: true,
      createdAt: '2024-01-01T12:00:00.000Z',
      updatedAt: '2024-01-01T12:00:00.000Z',
    },
  },
);

export const CreateLocationRequestSchema = LocationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateLocationRequestSchema = LocationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const LocationSearchCriteriaSchema = LocationSchema.pick({
  name: true,
  city: true,
  state: true,
  country: true,
  public: true,
  apiSource: true,
  category: true,
})
  .partial()
  .extend({
    coordinates: z
      .object({
        latitude: latitudeSchema,
        longitude: longitudeSchema,
        radius: z.number().min(0, { message: 'Radius must be at least 0 meters' }),
      })
      .optional(),
  });

export const LocationForItinerarySchema = extendApi(
  LocationSchema.omit({
    id: true,
    public: true,
    createdAt: true,
    updatedAt: true,
  }).extend({
    order: z.number().int().min(0).describe('Order position in the itinerary (0-indexed)'),
  }),
  {
    title: 'Location for Itinerary',
    description: 'Location data with ordering information for itinerary planning',
    example: {
      name: 'Eiffel Tower',
      description: 'Iconic iron lattice tower in Paris',
      address: 'Champ de Mars, 5 Avenue Anatole France',
      city: 'Paris',
      state: 'Île-de-France',
      country: 'France',
      postalCode: '75007',
      latitude: 48.8584,
      longitude: 2.2945,
      apiSource: 'HERE',
      apiSourceId: 'here:pds:place:250jx7ps-b9d7fc1d8dbc4dd9adb39e4b7cf0b2f7',
      category: 'ATTRACTION',
      order: 0,
    },
  },
);

export type LocationSearchCriteria = z.infer<typeof LocationSearchCriteriaSchema>;
export type UpdateLocationRequest = z.infer<typeof UpdateLocationRequestSchema>;
export type CreateLocationRequest = z.infer<typeof CreateLocationRequestSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type LocationForItinerary = z.infer<typeof LocationForItinerarySchema>;

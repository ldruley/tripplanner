import { z } from 'zod';
import { latitudeSchema, longitudeSchema, uuidSchema } from './base.schema';
import { ApiSourceProvider, LocationCategory, Prisma } from '@prisma/client';
import { extendApi } from '@anatine/zod-openapi';

export const LocationCategorySchema = z.nativeEnum(LocationCategory);
export const ApiSourceSchema = z.nativeEnum(ApiSourceProvider);

export const LocationSchema = extendApi(
  z.object({
    id: uuidSchema,
    name: z.string().min(1, { message: 'Name is required and must be at least 1 character' }),
    description: z.string().nullable().optional(),

    // Address fields to match Prisma
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    postalCode: z.string().nullable().optional(),

    // Location coordinates
    latitude: latitudeSchema,
    longitude: longitudeSchema,

    // API source and category
    apiSource: ApiSourceSchema.nullable().optional(),
    apiSourceId: z.string().nullable().optional(),
    fullData: z.any().nullable().optional(), // This is a temporary field for full API data - we will properly shape it later
    category: LocationCategorySchema.nullable().optional(),

    // Public flag for sharing
    public: z.boolean().default(false),

    // Standard database timestamps
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  {
    title: 'Location',
    description: 'Represents a physical location with address and coordinates.',
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

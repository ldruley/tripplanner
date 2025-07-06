import { z } from 'zod';
import { latitudeSchema, longitudeSchema, uuidSchema } from './base.schema';
import { ApiSourceProvider, LocationCategory, Prisma } from '@prisma/client';

export const LocationCategorySchema = z.nativeEnum(LocationCategory);
export const ApiSourceSchema = z.nativeEnum(ApiSourceProvider);

export const LocationSchema = z.object({
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
  category: LocationCategorySchema.nullable().optional(),

  // Public flag for sharing
  public: z.boolean().default(false),

  // Standard database timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

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
}).partial().extend({
  coordinates: z
    .object({
      latitude: latitudeSchema,
      longitude: longitudeSchema,
      radius: z.number().min(0, { message: 'Radius must be at least 0 meters' }),
    })
    .optional(),
});

export type LocationSearchCriteria = z.infer<typeof LocationSearchCriteriaSchema>;
export type UpdateLocationRequest = z.infer<typeof UpdateLocationRequestSchema>;
export type CreateLocationRequest = z.infer<typeof CreateLocationRequestSchema>;
export type Location = z.infer<typeof LocationSchema>;

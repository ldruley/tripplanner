import { z } from 'zod';
import { latitudeSchema, longitudeSchema, uuidSchema } from './base.schema';

export const LocationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Name is required'),
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
  apiSource: z.enum(['GOOGLE_PLACES', 'FOURSQUARE', 'OPENSTREETMAP', 'HERE', 'MAPBOX', 'USER_INPUT', 'INTERNAL_SEED']).nullable().optional(),
  apiSourceId: z.string().nullable().optional(),
  category: z.enum(['RESTAURANT', 'CAFE', 'HOTEL', 'ACCOMMODATION', 'LANDMARK', 'POINT_OF_INTEREST', 'TRANSPORT_HUB', 'SHOPPING', 'NATURE', 'MUSEUM', 'PARK', 'HISTORICAL_SITE', 'ENTERTAINMENT', 'OTHER']).nullable().optional(),
  
  // Public flag for sharing
  public: z.boolean().default(false),

  // Standard database timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Location = z.infer<typeof LocationSchema>;

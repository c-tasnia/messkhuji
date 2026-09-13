import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(10).max(3000),
  city: z.string().min(2).max(100),
  address: z.string().min(5).max(300),
  rentAmount: z.number().positive(),
  roomType: z.enum(['single', 'shared', 'mess', 'apartment']),
  capacity: z.number().int().positive().max(20).default(1),
  amenities: z.array(z.string()).max(30).default([]),
  images: z.array(z.string().url()).max(10).default([]),
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listingQuerySchema = z.object({
  city: z.string().optional(),
  roomType: z.enum(['single', 'shared', 'mess', 'apartment']).optional(),
  minRent: z.coerce.number().nonnegative().optional(),
  maxRent: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingQueryInput = z.infer<typeof listingQuerySchema>;

import { z } from 'zod';

export const createBookingSchema = z
  .object({
    listingId: z.string().uuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

import { Prisma, BookingStatus, ListingStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { AppError } from '../utils/apiResponse';
import { cacheDelByPrefix } from '../config/redis';
import { v4 as uuidv4 } from 'uuid';

interface CreateBookingParams {
  listingId: string;
  customerId: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Creates a booking hold for a listing.
 *
 * Concurrency safety: two customers could hit this endpoint for the same
 * listing/date-range at nearly the same instant. To prevent a double-booking
 * race condition we:
 *   1. Run the whole check-then-insert as one Serializable transaction.
 *   2. Take a row lock on the listing (`SELECT ... FOR UPDATE`) so a second
 *      concurrent transaction for the same listing blocks until the first
 *      commits, instead of both reading "no conflict" simultaneously.
 * If a genuine conflict is detected under concurrent load, Postgres raises a
 * serialization failure, which we surface as a normal 409 to the caller
 * (the client can safely retry).
 */
export async function createBookingWithLock(params: CreateBookingParams) {
  const { listingId, customerId, startDate, endDate } = params;

  return prisma.$transaction(
    async (tx) => {
      // Lock the listing row for the duration of this transaction so no
      // other concurrent booking transaction for the same listing can
      // proceed past this point until we commit or roll back.
      const lockedListing = await tx.$queryRaw<
        { id: string; rentAmount: Prisma.Decimal; status: ListingStatus }[]
      >(Prisma.sql`SELECT id, "rentAmount", status FROM "Listing" WHERE id = ${listingId} FOR UPDATE`);

      const listing = lockedListing[0];
      if (!listing) {
        throw new AppError(404, 'Listing not found.');
      }
      if (listing.status !== ListingStatus.ACTIVE) {
        throw new AppError(400, 'This listing is not currently available for booking.');
      }

      // Check for any overlapping, still-live booking on this listing.
      // A booking "occupies" the slot while PENDING_PAYMENT or CONFIRMED.
      const overlapping = await tx.booking.findFirst({
        where: {
          listingId,
          status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
          startDate: { lt: endDate },
          endDate: { gt: startDate },
        },
        select: { id: true },
      });

      if (overlapping) {
        throw new AppError(409, 'This listing is already booked for the selected dates.');
      }

      const days = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      // Simple pricing model: rentAmount is treated as a monthly rate,
      // pro-rated daily. Adjust to your product's actual pricing rules.
      const totalAmount = new Prisma.Decimal(listing.rentAmount).mul(days).div(30);

      const booking = await tx.booking.create({
        data: {
          id: uuidv4(),
          listingId,
          customerId,
          startDate,
          endDate,
          totalAmount,
          status: BookingStatus.PENDING_PAYMENT,
        },
      });

      return booking;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** Confirms a booking after a verified successful payment, inside a transaction. */
export async function confirmBookingAfterPayment(bookingId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
    });
    return booking;
  });
}

/** Releases a booking hold when payment fails/cancels/expires. */
export async function releaseBooking(bookingId: string) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });
  await cacheDelByPrefix('listing:');
}

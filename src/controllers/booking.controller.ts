import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created, AppError } from '../utils/apiResponse';
import { CreateBookingInput } from '../validators/booking.validator';
import { createBookingWithLock, releaseBooking } from '../services/booking.service';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateBookingInput;

  try {
    const booking = await createBookingWithLock({
      listingId: input.listingId,
      customerId: req.user!.sub,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    return created(res, booking, 'Booking hold created. Proceed to payment to confirm.');
  } catch (err: unknown) {
    // Postgres serialization failure under concurrent load — safe to retry.
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '40001') {
      throw new AppError(409, 'This slot is being booked by someone else right now. Please try again.');
    }
    throw err;
  }
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.user!.sub },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      listing: { select: { id: true, title: true, city: true, images: true } },
      payment: { select: { status: true, transactionId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, bookings);
});

export const getProviderBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    where: { listing: { providerId: req.user!.sub } },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      listing: { select: { id: true, title: true } },
      payment: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, bookings);
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.customerId !== req.user!.sub && req.user!.role !== 'ADMIN') {
    throw new AppError(403, 'You can only cancel your own bookings.');
  }
  if (booking.status === 'CONFIRMED') {
    throw new AppError(400, 'A confirmed (paid) booking cannot be self-cancelled. Contact support.');
  }

  await releaseBooking(id);
  return ok(res, null, 'Booking cancelled.');
});

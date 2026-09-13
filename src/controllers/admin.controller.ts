import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, AppError } from '../utils/apiResponse';
import { invalidateListingCaches } from '../services/cache.service';
import { Role, ListingStatus } from '@prisma/client';

export const listAllUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, users);
});

export const setUserActive = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body as { isActive: boolean };

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });
  return ok(res, user, `User ${isActive ? 'activated' : 'deactivated'}.`);
});

export const promoteUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body as { role: Role };

  if (!Object.values(Role).includes(role)) {
    throw new AppError(400, 'Invalid role.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });
  return ok(res, user, `User role updated to ${role}.`);
});

export const moderateListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: ListingStatus };

  const listing = await prisma.listing.update({
    where: { id },
    data: { status },
    select: { id: true, title: true, status: true },
  });

  await invalidateListingCaches();
  return ok(res, listing, 'Listing moderated.');
});

export const platformStats = asyncHandler(async (_req: Request, res: Response) => {
  const [userCount, listingCount, bookingCount, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count({ where: { status: { not: ListingStatus.DELETED } } }),
    prisma.booking.count(),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    }),
  ]);

  return ok(res, {
    userCount,
    listingCount,
    bookingCount,
    totalRevenue: revenue._sum.amount || 0,
  });
});

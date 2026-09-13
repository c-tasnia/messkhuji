import { Request, Response } from 'express';
import { Prisma, ListingStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created, AppError } from '../utils/apiResponse';
import { CreateListingInput, ListingQueryInput } from '../validators/listing.validator';
import {
  getCachedListingDetail,
  setCachedListingDetail,
  getCachedListingSearch,
  setCachedListingSearch,
  invalidateListingCaches,
} from '../services/cache.service';

// Fields we actually need on list/detail views — `select` keeps the query
// lean instead of pulling every column (and never leaks providerId internals
// beyond what's needed).
const listingSummarySelect = {
  id: true,
  title: true,
  city: true,
  rentAmount: true,
  roomType: true,
  capacity: true,
  images: true,
  status: true,
  createdAt: true,
  provider: { select: { id: true, name: true } },
} satisfies Prisma.ListingSelect;

const listingDetailSelect = {
  ...listingSummarySelect,
  description: true,
  address: true,
  amenities: true,
  updatedAt: true,
} satisfies Prisma.ListingSelect;

export const createListing = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateListingInput;

  const listing = await prisma.listing.create({
    data: { ...input, providerId: req.user!.sub },
    select: listingDetailSelect,
  });

  await invalidateListingCaches();
  return created(res, listing, 'Listing created.');
});

export const searchListings = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListingQueryInput;
  const cacheKey = JSON.stringify(query);

  const cached = await getCachedListingSearch(cacheKey);
  if (cached) return ok(res, cached, 'Listings (cached)');

  const where: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
    ...(query.roomType ? { roomType: query.roomType } : {}),
    ...(query.minRent || query.maxRent
      ? {
          rentAmount: {
            ...(query.minRent ? { gte: query.minRent } : {}),
            ...(query.maxRent ? { lte: query.maxRent } : {}),
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;

  // This query benefits directly from the @@index([city, status]) index in
  // the Prisma schema — city + status is the primary filter on this path.
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      select: listingSummarySelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  const result = { items, total, page: query.page, limit: query.limit };
  await setCachedListingSearch(cacheKey, result);
  return ok(res, result);
});

export const getListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const cached = await getCachedListingDetail(id);
  if (cached) return ok(res, cached, 'Listing (cached)');

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: listingDetailSelect,
  });
  if (!listing || listing.status === ListingStatus.DELETED) {
    throw new AppError(404, 'Listing not found.');
  }

  await setCachedListingDetail(id, listing);
  return ok(res, listing);
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const listing = await prisma.listing.findUnique({ where: { id }, select: { providerId: true } });
  if (!listing) throw new AppError(404, 'Listing not found.');
  if (listing.providerId !== req.user!.sub && req.user!.role !== 'ADMIN') {
    throw new AppError(403, 'You can only edit your own listings.');
  }

  const updated = await prisma.listing.update({
    where: { id },
    data: req.body,
    select: listingDetailSelect,
  });

  await invalidateListingCaches();
  return ok(res, updated, 'Listing updated.');
});

export const deleteListing = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const listing = await prisma.listing.findUnique({ where: { id }, select: { providerId: true } });
  if (!listing) throw new AppError(404, 'Listing not found.');
  if (listing.providerId !== req.user!.sub && req.user!.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own listings.');
  }

  // Soft delete — preserves referential integrity for existing bookings/history.
  await prisma.listing.update({ where: { id }, data: { status: ListingStatus.DELETED } });
  await invalidateListingCaches();
  return ok(res, null, 'Listing deleted.');
});

export const myListings = asyncHandler(async (req: Request, res: Response) => {
  const listings = await prisma.listing.findMany({
    where: { providerId: req.user!.sub, status: { not: ListingStatus.DELETED } },
    select: listingDetailSelect,
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, listings);
});

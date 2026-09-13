import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createListing,
  searchListings,
  getListing,
  updateListing,
  deleteListing,
  myListings,
} from '../controllers/listing.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../middleware/validate.middleware';
import { createListingSchema, updateListingSchema, listingQuerySchema } from '../validators/listing.validator';

const router = Router();

// Public: anyone can browse listings.
router.get('/', validateQuery(listingQuerySchema), searchListings);
router.get('/:id', getListing);

// Provider-only: manage own listings.
router.post('/', authenticate, authorize(Role.PROVIDER), validateBody(createListingSchema), createListing);
router.get('/mine/all', authenticate, authorize(Role.PROVIDER), myListings);
router.patch('/:id', authenticate, authorize(Role.PROVIDER, Role.ADMIN), validateBody(updateListingSchema), updateListing);
router.delete('/:id', authenticate, authorize(Role.PROVIDER, Role.ADMIN), deleteListing);

export default router;

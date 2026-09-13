import { Router } from 'express';
import { Role } from '@prisma/client';
import { createBooking, getMyBookings, getProviderBookings, cancelBooking } from '../controllers/booking.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createBookingSchema } from '../validators/booking.validator';

const router = Router();

router.use(authenticate);

router.post('/', authorize(Role.CUSTOMER), validateBody(createBookingSchema), createBooking);
router.get('/mine', authorize(Role.CUSTOMER), getMyBookings);
router.get('/provider', authorize(Role.PROVIDER), getProviderBookings);
router.post('/:id/cancel', authorize(Role.CUSTOMER, Role.ADMIN), cancelBooking);

export default router;

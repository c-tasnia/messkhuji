import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import listingRoutes from './listing.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.get('/health', (_req, res) => res.status(200).json({ success: true, message: 'messkhuji API is healthy' }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/listings', listingRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

export default router;

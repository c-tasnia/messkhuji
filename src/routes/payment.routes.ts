import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  initiateBookingPayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIpn,
  getPaymentStatus,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import { paymentLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Customer-initiated, authenticated.
router.post('/initiate', authenticate, authorize(Role.CUSTOMER), paymentLimiter, initiateBookingPayment);
router.get('/status/:bookingId', authenticate, getPaymentStatus);

// Gateway callbacks — called directly by SSLCommerz's servers/browser
// redirects, so these cannot require our JWT. Trust is instead established
// by independently re-validating with SSLCommerz inside the controller
// (see sslcommerz.service.ts `validatePayment`), never from the callback
// body alone.
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);
router.post('/cancel', paymentCancel);
router.post('/ipn', paymentIpn);

export default router;

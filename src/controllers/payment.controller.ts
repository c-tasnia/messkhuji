import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatus, BookingStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, created, AppError } from '../utils/apiResponse';
import { initiatePayment, validatePayment } from '../services/sslcommerz.service';
import { confirmBookingAfterPayment, releaseBooking } from '../services/booking.service';
import { env } from '../config/env';

/**
 * Step 1: Customer requests payment for their pending booking.
 * Creates our own Payment record (status INITIATED) and asks SSLCommerz for
 * a hosted checkout session, returning the GatewayPageURL to redirect to.
 */
export const initiateBookingPayment = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.body as { bookingId: string };

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true, payment: true },
  });

  if (!booking) throw new AppError(404, 'Booking not found.');
  if (booking.customerId !== req.user!.sub) {
    throw new AppError(403, 'You can only pay for your own booking.');
  }
  if (booking.status !== BookingStatus.PENDING_PAYMENT) {
    throw new AppError(400, `Booking is not awaiting payment (current status: ${booking.status}).`);
  }
  if (booking.payment && booking.payment.status === PaymentStatus.SUCCESS) {
    throw new AppError(409, 'This booking has already been paid for.');
  }

  const transactionId = `MSK-${uuidv4()}`;

  const gatewayResponse = await initiatePayment({
    transactionId,
    amount: Number(booking.totalAmount),
    customerName: booking.customer.name,
    customerEmail: booking.customer.email,
    customerPhone: booking.customer.phone || '01700000000',
    bookingId: booking.id,
  });

  if (gatewayResponse.status !== 'SUCCESS' || !gatewayResponse.GatewayPageURL) {
    throw new AppError(502, 'Failed to initiate payment with the payment gateway.', {
      reason: gatewayResponse.failedreason,
    });
  }

  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: {
      bookingId: booking.id,
      amount: booking.totalAmount,
      transactionId,
      gatewaySessionKey: gatewayResponse.sessionkey,
      status: PaymentStatus.INITIATED,
    },
    update: {
      transactionId,
      gatewaySessionKey: gatewayResponse.sessionkey,
      status: PaymentStatus.INITIATED,
    },
  });

  return created(res, { gatewayUrl: gatewayResponse.GatewayPageURL, transactionId }, 'Payment session created.');
});

/** Shared logic: independently re-validates with SSLCommerz before trusting any callback. */
async function handleGatewayCallback(req: Request, outcome: 'success' | 'fail' | 'cancel') {
  const body = req.body as Record<string, string>;
  const bookingId = body.value_a;
  const valId = body.val_id;

  if (!bookingId) return { redirectStatus: 'error' as const };

  if (outcome !== 'success' || !valId) {
    await releaseBooking(bookingId).catch(() => undefined);
    await prisma.payment.updateMany({
      where: { bookingId },
      data: { status: outcome === 'cancel' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED },
    });
    return { redirectStatus: outcome };
  }

  // Never trust the redirect body alone — independently validate against
  // SSLCommerz's server using our store credentials.
  const validation = await validatePayment(valId);
  const isValid = validation.status === 'VALID' || validation.status === 'VALIDATED';

  if (!isValid) {
    await releaseBooking(bookingId).catch(() => undefined);
    await prisma.payment.updateMany({
      where: { bookingId },
      data: { status: PaymentStatus.FAILED, gatewayResponse: validation as object },
    });
    return { redirectStatus: 'fail' as const };
  }

  await prisma.payment.updateMany({
    where: { bookingId },
    data: {
      status: PaymentStatus.SUCCESS,
      gatewayResponse: validation as object,
    },
  });
  await confirmBookingAfterPayment(bookingId);
  return { redirectStatus: 'success' as const };
}

export const paymentSuccess = asyncHandler(async (req: Request, res: Response) => {
  const { redirectStatus } = await handleGatewayCallback(req, 'success');
  res.redirect(`${env.frontendBaseUrl}/payment/${redirectStatus}`);
});

export const paymentFail = asyncHandler(async (req: Request, res: Response) => {
  await handleGatewayCallback(req, 'fail');
  res.redirect(`${env.frontendBaseUrl}/payment/fail`);
});

export const paymentCancel = asyncHandler(async (req: Request, res: Response) => {
  await handleGatewayCallback(req, 'cancel');
  res.redirect(`${env.frontendBaseUrl}/payment/cancel`);
});

/**
 * SSLCommerz Instant Payment Notification — a server-to-server callback that
 * fires independently of whether the customer's browser ever makes it back
 * to success_url. This is what makes status tracking reliable even if the
 * user closes their browser mid-redirect.
 */
export const paymentIpn = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const bookingId = body.value_a;
  const valId = body.val_id;

  if (bookingId && valId) {
    const validation = await validatePayment(valId);
    const isValid = validation.status === 'VALID' || validation.status === 'VALIDATED';

    if (isValid) {
      await prisma.payment.updateMany({
        where: { bookingId },
        data: { status: PaymentStatus.SUCCESS, gatewayResponse: validation as object },
      });
      await confirmBookingAfterPayment(bookingId);
    } else {
      await prisma.payment.updateMany({
        where: { bookingId },
        data: { status: PaymentStatus.FAILED, gatewayResponse: validation as object },
      });
    }
  }

  // SSLCommerz just needs a 200 acknowledging receipt.
  res.status(200).send('IPN received');
});

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    select: { status: true, amount: true, transactionId: true, createdAt: true, updatedAt: true, booking: { select: { customerId: true } } },
  });

  if (!payment) throw new AppError(404, 'No payment found for this booking.');
  if (payment.booking.customerId !== req.user!.sub && req.user!.role !== 'ADMIN') {
    throw new AppError(403, 'Not authorized to view this payment.');
  }

  return ok(res, {
    status: payment.status,
    amount: payment.amount,
    transactionId: payment.transactionId,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  });
});

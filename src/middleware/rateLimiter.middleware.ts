import rateLimit from 'express-rate-limit';

// General API abuse protection: 100 requests / minute / IP.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

// Tighter limiter for auth endpoints (login/register) to blunt credential
// stuffing / brute force attempts: 10 attempts / 15 minutes / IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

// Payment initiation is sensitive and can hammer the gateway if abused.
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment requests. Please try again shortly.',
  },
});

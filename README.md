# Messkhuji — Housing & Roommate Platform (Backend)

Serverless Node.js/TypeScript backend, deployed on Vercel. PostgreSQL via Prisma, Redis caching via Upstash, payments via **SSLCommerz**.

## Stack

- Express (wrapped for Vercel via `serverless-http`)
- Prisma + PostgreSQL
- Upstash Redis (REST-based, serverless-safe)
- SSLCommerz (`sslcommerz-lts`) — mandatory payment gateway
- JWT auth (access + refresh) with bcrypt password hashing
- helmet, cors, express-rate-limit, zod validation

## Roles (fixed, strictly enforced)

| Role | Can do |
|---|---|
| **CUSTOMER** | Browse listings, create bookings, pay, view/cancel own bookings |
| **PROVIDER** | Create/update/delete own listings, view bookings on own listings |
| **ADMIN** | Manage users (activate/deactivate, change role), moderate any listing, view platform stats |

Enforced via `authenticate` (JWT) + `authorize(...roles)` middleware on every private route — see `src/middleware/rbac.middleware.ts`. Admin accounts are never self-registered (the register endpoint only allows CUSTOMER/PROVIDER); promote a user via `PATCH /api/admin/users/:id/role` or seed one directly.

## Payment integration (SSLCommerz) — mandatory, real gateway flow

1. `POST /api/bookings` — customer creates a booking hold (`PENDING_PAYMENT`), inside a Serializable DB transaction with a row-level lock (`SELECT ... FOR UPDATE`) on the listing to prevent double-booking races.
2. `POST /api/payments/initiate` — creates a real SSLCommerz checkout session and returns `gatewayUrl` for the frontend to redirect to.
3. Customer pays on SSLCommerz's hosted page.
4. SSLCommerz calls back to **our server**, not the browser alone:
   - `POST /api/payments/success` / `/fail` / `/cancel` — browser redirect targets.
   - `POST /api/payments/ipn` — server-to-server Instant Payment Notification; the real source of truth, fires even if the customer closes their browser.
5. Every callback **independently re-validates** the transaction against SSLCommerz's Validation API (`validatePayment`) using our store credentials — the callback body itself is never trusted blindly.
6. On confirmed success, the booking flips to `CONFIRMED` inside a transaction; on failure/cancellation, the hold is released back to `CANCELLED` so the slot becomes bookable again.
7. `GET /api/payments/status/:bookingId` — poll current payment status at any time.

No cash-on-delivery, pay-later, or manually-set "paid" flags anywhere in the codebase — status only ever changes via a validated gateway response.

## Security

- Passwords hashed with bcrypt (`BCRYPT_SALT_ROUNDS`, default 12).
- JWT access (short-lived) + refresh tokens; secrets only ever read from env vars, never hardcoded.
- All non-public routes require `authenticate`; `.env` is git-ignored, `.env.example` documents required vars without values.
- `helmet()` security headers; strict `cors()` allow-list from `CORS_ORIGINS`.
- `express-rate-limit`: general (100 req/min/IP), auth (10 req/15min/IP), payments (20 req/min/IP).
- Centralized error handler never leaks stack traces or secrets to clients.

## Performance & concurrency

- Prisma `select` used throughout (see `listing.controller.ts`) — never over-fetches columns.
- Composite index `@@index([city, status])` on `Listing` backs the primary search path; additional indexes on `providerId`, booking `[listingId, status]`, and payment `status`/`transactionId`.
- Redis caching (Upstash) for listing search results (2 min TTL) and listing detail (5 min TTL), invalidated on any create/update/delete.
- Booking creation runs as a **Serializable transaction with row locking** (`booking.service.ts`) — the standard way to defeat the classic double-booking race condition; a genuine conflict surfaces as a safe-to-retry `409`.

## Setup

```bash
cp .env.example .env   # fill in real values
npm install
npm run prisma:generate
npm run prisma:migrate:dev   # creates tables locally
npm run seed                 # optional: admin/provider/customer + 1 listing
npm run dev                  # local dev server on :4000
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Set all variables from `.env.example` in Vercel's Environment Variables (use a **pooled** `DATABASE_URL` — e.g. Neon/Supabase pooled connection or Prisma Accelerate — since each serverless invocation opens its own connection).
4. Vercel runs `vercel-build` (`prisma generate && tsc`) automatically; `vercel.json` rewrites all traffic to `api/index.ts`.
5. Run `npx prisma migrate deploy` against your production database once (from CI or locally, pointed at prod `DATABASE_URL`).
6. Register a store with SSLCommerz (sandbox first: https://developer.sslcommerz.com/registration/), and set `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` / `APP_BASE_URL` accordingly. In the SSLCommerz sandbox panel, nothing further needs whitelisting — success/fail/cancel/IPN URLs are sent dynamically on each session init.

## API summary

```
POST   /api/auth/register          public   {name,email,password,phone?,role: CUSTOMER|PROVIDER}
POST   /api/auth/login             public
POST   /api/auth/refresh           public
GET    /api/auth/me                auth

GET    /api/listings               public   ?city&roomType&minRent&maxRent&page&limit
GET    /api/listings/:id           public
POST   /api/listings               PROVIDER
GET    /api/listings/mine/all      PROVIDER
PATCH  /api/listings/:id           PROVIDER (own) | ADMIN
DELETE /api/listings/:id           PROVIDER (own) | ADMIN

POST   /api/bookings               CUSTOMER
GET    /api/bookings/mine          CUSTOMER
GET    /api/bookings/provider      PROVIDER
POST   /api/bookings/:id/cancel    CUSTOMER (own) | ADMIN

POST   /api/payments/initiate      CUSTOMER   {bookingId}
GET    /api/payments/status/:bookingId  auth
POST   /api/payments/success       gateway callback (public, re-validated server-side)
POST   /api/payments/fail          gateway callback
POST   /api/payments/cancel        gateway callback
POST   /api/payments/ipn           gateway callback (server-to-server)

GET    /api/admin/users            ADMIN
PATCH  /api/admin/users/:id/active ADMIN
PATCH  /api/admin/users/:id/role   ADMIN
PATCH  /api/admin/listings/:id/moderate  ADMIN
GET    /api/admin/stats            ADMIN
```

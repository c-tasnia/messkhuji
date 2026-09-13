import { PrismaClient } from '@prisma/client';

// In serverless environments (Vercel), each cold start can create a new
// PrismaClient. Caching it on `globalThis` prevents connection-pool
// exhaustion across hot invocations within the same lambda instance.
declare global {
  // eslint-disable-next-line no-var
  var __messkhujiPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__messkhujiPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__messkhujiPrisma = prisma;
}

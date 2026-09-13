import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../utils/apiResponse';
import { created, ok } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RegisterInput;

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
      role: input.role, // CUSTOMER or PROVIDER only — enforced by the zod schema
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role, email: user.email });

  return created(res, { user, accessToken, refreshToken }, 'Account created.');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    // Same message for "no such user" and "wrong password" — never reveal
    // which one it was, to avoid leaking account existence.
    throw new AppError(401, 'Invalid email or password.');
  }

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) {
    throw new AppError(401, 'Invalid email or password.');
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ sub: user.id, role: user.role, email: user.email });

  return ok(res, {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  }, 'Logged in.');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token.');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    throw new AppError(401, 'Account no longer active.');
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  return ok(res, { accessToken }, 'Token refreshed.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'User not found.');
  return ok(res, user);
});

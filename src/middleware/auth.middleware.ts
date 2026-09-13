import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { AppError } from '../utils/apiResponse';
import { prisma } from '../config/db';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError(401, 'Authentication required. Provide a Bearer token.');
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    // Re-check the user still exists and is active on every request — a
    // deleted/deactivated account should be locked out immediately, not just
    // once its old access token expires.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true, email: true },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'Account no longer active. Please log in again.');
    }

    req.user = { sub: user.id, role: user.role, email: user.email };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, 'Invalid or expired token.'));
  }
}

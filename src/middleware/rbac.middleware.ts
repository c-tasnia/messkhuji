import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/apiResponse';

/**
 * Strict role enforcement. Every private route must declare exactly which
 * of the 3 fixed roles (CUSTOMER, PROVIDER, ADMIN) may call it.
 * Must run after `authenticate`.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          `Access denied. Requires one of: ${allowedRoles.join(', ')}.`
        )
      );
    }
    next();
  };
}

/**
 * For resource-owner-or-admin checks (e.g. a Provider editing only their own
 * listing, or a Customer viewing only their own booking). `getOwnerId` pulls
 * the owning user id off whatever was loaded onto `req` upstream.
 */
export function authorizeOwnerOrAdmin(getOwnerId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required.'));
    if (req.user.role === Role.ADMIN) return next();

    const ownerId = getOwnerId(req);
    if (!ownerId || ownerId !== req.user.sub) {
      return next(new AppError(403, 'You do not have access to this resource.'));
    }
    next();
  };
}

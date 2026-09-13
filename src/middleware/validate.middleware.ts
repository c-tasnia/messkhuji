import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodTypeAny } from 'zod';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function validateQuery(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Assign parsed fields individually — req.query is a getter-only
      // property on some Express/Node versions and can't be reassigned wholesale.
      const parsed = schema.parse(req.query);
      Object.assign(req.query, parsed);
      (req as Request & { validatedQuery?: unknown }).validatedQuery = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}

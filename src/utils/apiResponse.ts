import { Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function ok(res: Response, data: unknown, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function created(res: Response, data: unknown, message = 'Created') {
  return ok(res, data, message, 201);
}

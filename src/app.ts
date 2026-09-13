import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';

export function createApp(): Application {
  const app = express();

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // CORS: only the explicitly configured origins may call the API with
  // credentials; anything else is rejected by the browser.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // General-purpose API abuse protection on every route.
  app.use(generalLimiter);

  // JSON body for normal API calls.
  app.use(express.json({ limit: '1mb' }));
  // SSLCommerz posts callback data as x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import authRouter from './routes/auth.js';

/**
 * Creates and configures the Express application.
 * @param {object} shopify - The initialized Shopify SDK instance.
 * @returns {import('express').Express} Configure Express app instance.
 */
export function createApp(shopify) {
  const app = express();

  // Middleware for parsing requests
  app.use(express.json({
    verify: (req, res, buf, encoding) => {
      if (buf && buf.length > 0) req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true }));

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(['/', '/api/auth'], limiter);

  // Mount the Auth Router
  app.use('/', authRouter);

  // Global error handler - must accept 4 parameters to be treated as error middleware
  app.use((err, req, res, next) => {
    // Log the error internally (no stack trace leak to clients)
    console.error('Unhandled error:', err.message || err);

    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

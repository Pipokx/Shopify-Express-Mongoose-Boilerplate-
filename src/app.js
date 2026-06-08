import express from 'express';
import authRouter from './routes/auth.js';

/**
 * Creates and configures the Express application.
 * @param {object} shopify - The initialized Shopify SDK instance.
 * @returns {import('express').Express} Configure Express app instance.
 */
export function createApp(shopify) {
  const app = express();

  // Middleware for parsing requests
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

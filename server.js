import { validateAndLoadEnv } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/db/connection.js';
import { CustomSessionStorage } from './src/storage/CustomSessionStorage.js';
import { initShopify } from './src/config/shopify.js';
import { createApp } from './src/app.js';

async function startServer() {
  let config;
  try {
    // Step 1: Validate and load environment variables
    config = validateAndLoadEnv();
  } catch (error) {
    console.error('Configuration validation failed:', error.message);
    process.exit(1);
  }

  try {
    // Step 2: Establish database connection
    await connectDB(config.mongodbUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection failed:', error.message || error);
    process.exit(1);
  }

  // Step 3: Initialize session storage and Shopify SDK
  const sessionStorage = new CustomSessionStorage();
  const shopify = initShopify(config, sessionStorage);

  // Step 4: Create Express application
  const app = createApp(shopify);

  // Step 5: Start listening for HTTP requests
  const server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });

  // Step 6: Graceful shutdown handler
  const shutdown = async () => {
    console.log('Graceful shutdown initiated...');
    try {
      await disconnectDB();
      console.log('MongoDB disconnected');
    } catch (err) {
      console.error('Error disconnecting MongoDB:', err.message || err);
    }

    server.close(() => {
      console.log('HTTP server closed. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();

import { describe, it, expect, vi } from 'vitest';

// Mock env validation
vi.mock('../src/config/env.js', () => ({
  validateAndLoadEnv: vi.fn(() => ({
    apiKey: 'test_key',
    apiSecretKey: 'test_secret',
    scopes: 'read_products',
    host: 'https://test-app.myshopify.com',
    port: 3000,
    mongodbUri: 'mongodb://localhost:27017/db',
    appSlug: 'test-app'
  }))
}));

// Mock database connection and record execution order
const callOrder = [];
vi.mock('../src/db/connection.js', () => ({
  connectDB: vi.fn(async () => {
    callOrder.push('connectDB');
  }),
  disconnectDB: vi.fn()
}));

// Mock app creation and server listening
vi.mock('../src/app.js', () => ({
  createApp: vi.fn(() => ({
    listen: vi.fn((port, cb) => {
      callOrder.push('listen');
      return { close: vi.fn() };
    })
  }))
}));

// Mock shopify SDK configuration
vi.mock('../src/config/shopify.js', () => ({
  initShopify: vi.fn(),
  getShopify: vi.fn()
}));

describe('Server Startup Sequence', () => {
  it('should establish MongoDB connection before the Express server starts listening', async () => {
    // Dynamically import server.js to run the startup sequence
    await import('../server.js');

    // Assert correct order of operations
    expect(callOrder).toEqual(['connectDB', 'listen']);
  });
});

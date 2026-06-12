import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { validateAndLoadEnv } from './env.js';

const REQUIRED_VARS = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_SCOPES',
  'HOST',
  'PORT',
  'MONGODB_URI',
  'APP_SLUG',
  'ENCRYPTION_KEY'
];

describe('validateAndLoadEnv', () => {
  let originalEnv;

  beforeEach(() => {
    // Back up original process.env
    originalEnv = { ...process.env };
    // Clear required environment variables to ensure isolation
    REQUIRED_VARS.forEach(key => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  // Helper to set valid default environment variables
  function setValidEnv() {
    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_SCOPES = 'read_products';
    process.env.HOST = 'https://test.myshopify.com';
    process.env.PORT = '3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
    process.env.APP_SLUG = 'test-app';
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2'; // 64 hex chars
  }

  it('should return a frozen config object when all required variables are present and valid', () => {
    setValidEnv();

    const config = validateAndLoadEnv();

    expect(config).toEqual({
      apiKey: 'test_key',
      apiSecretKey: 'test_secret',
      scopes: 'read_products',
      host: 'https://test.myshopify.com',
      port: '3000',
      mongodbUri: 'mongodb://localhost:27017/db',
      appSlug: 'test-app',
      encryptionKey: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2'
    });

    expect(Object.isFrozen(config)).toBe(true);
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 1: Startup fails fast on any missing environment variable
  it('Property 1: Startup fails fast on any missing environment variable', () => {
    fc.assert(
      fc.property(
        // Generate a non-empty subset of REQUIRED_VARS to remove
        fc.subarray(REQUIRED_VARS, { minLength: 1 }),
        (missingVars) => {
          // Reset environment to a valid state
          setValidEnv();
          // Remove the chosen subset of variables
          missingVars.forEach(key => {
            delete process.env[key];
          });

          // Assert that it throws
          expect(() => validateAndLoadEnv()).toThrow();

          try {
            validateAndLoadEnv();
          } catch (error) {
            // The error message must list all missing variables
            missingVars.forEach(key => {
              expect(error.message).toContain(key);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 2: Startup fails fast on a malformed MONGODB_URI
  it('Property 2: Startup fails fast on a malformed MONGODB_URI', () => {
    fc.assert(
      fc.property(
        // Generate any string that doesn't start with mongodb:// or mongodb+srv://
        fc.string().filter(s => !s.startsWith('mongodb://') && !s.startsWith('mongodb+srv://')),
        (malformedUri) => {
          setValidEnv();
          process.env.MONGODB_URI = malformedUri;

          expect(() => validateAndLoadEnv()).toThrow();

          try {
            validateAndLoadEnv();
          } catch (error) {
            expect(error.message).toContain('MONGODB_URI');
            expect(error.message.toLowerCase()).toContain('malformed');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fail fast if ENCRYPTION_KEY is not a valid 64-character hex string', () => {
    setValidEnv();
    
    // Test shorter key
    process.env.ENCRYPTION_KEY = 'short_key';
    expect(() => validateAndLoadEnv()).toThrow(/ENCRYPTION_KEY.*malformed/);

    // Test non-hex key of correct length
    process.env.ENCRYPTION_KEY = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
    expect(() => validateAndLoadEnv()).toThrow(/ENCRYPTION_KEY.*malformed/);
  });

  // Additional unit tests
  it('should identify all missing variables when multiple are absent', () => {
    process.env.SHOPIFY_API_KEY = 'test_key';
    // HOST, PORT, MONGODB_URI, etc., are missing
    expect(() => validateAndLoadEnv()).toThrow(/SHOPIFY_API_SECRET.*SHOPIFY_SCOPES.*HOST.*PORT.*MONGODB_URI.*APP_SLUG/);
  });
});

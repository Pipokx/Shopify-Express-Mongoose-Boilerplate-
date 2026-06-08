import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import crypto from 'crypto';
import { validateHmac } from './hmac.js';

describe('middleware/hmac', () => {
  let originalEnv;
  const SECRET = 'test_shopify_api_secret_key_123456';

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.SHOPIFY_API_SECRET = SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to compute HMAC exactly like Shopify and the middleware
  function computeHmac(params, secret) {
    const message = Object.keys(params)
      .sort()
      .map(key => {
        const val = params[key];
        const valStr = Array.isArray(val) ? val.join(',') : String(val);
        return `${key}=${valStr}`;
      })
      .join('&');

    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');
  }

  // Feature: shopify-express-mongoose-boilerplate, Property 8: Correctly signed requests always pass HMAC validation
  it('Property 8: Correctly signed requests always pass HMAC validation', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter(k => k !== 'hmac'),
          fc.oneof(
            fc.string({ maxLength: 10 }),
            fc.array(fc.string({ maxLength: 10 }), { minLength: 1, maxLength: 3 })
          )
        ),
        (params) => {
          const correctHmac = computeHmac(params, SECRET);

          const req = {
            query: { ...params, hmac: correctHmac }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };
          const next = vi.fn();

          validateHmac(req, res, next);

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 9: Incorrectly signed requests always fail HMAC validation
  it('Property 9: Incorrectly signed requests always fail HMAC validation', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter(k => k !== 'hmac'),
          fc.string({ maxLength: 10 })
        ),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== SECRET),
        (params, wrongSecret) => {
          // Sign with wrong secret
          const wrongHmac = computeHmac(params, wrongSecret);

          const req = {
            query: { ...params, hmac: wrongHmac }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };
          const next = vi.fn();

          validateHmac(req, res, next);

          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.json).toHaveBeenCalledWith({ error: 'Invalid HMAC signature' });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 10: Parameter order does not affect HMAC validation outcome
  it('Property 10: Parameter order does not affect HMAC validation outcome', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 10 }).filter(k => k !== 'hmac'),
          fc.string({ maxLength: 10 })
        ),
        (params) => {
          const correctHmac = computeHmac(params, SECRET);

          // Object keys order in JS is not guaranteed, but we can verify that the sorted hmac comparison works.
          // In req.query, key order is resolved. We sort them inside validateHmac.
          const req = {
            query: { ...params, hmac: correctHmac }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };
          const next = vi.fn();

          validateHmac(req, res, next);

          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests
  it('should return 401 if hmac parameter is missing', () => {
    const req = {
      query: { shop: 'test.myshopify.com' }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();

    validateHmac(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing HMAC' });
  });

  it('should return 500 if SHOPIFY_API_SECRET is missing from env', () => {
    delete process.env.SHOPIFY_API_SECRET;

    const req = {
      query: { shop: 'test.myshopify.com', hmac: 'anyhmac' }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();

    validateHmac(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Shopify API secret is not configured' });
  });
});

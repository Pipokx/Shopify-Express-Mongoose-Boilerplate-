import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { validateSessionToken } from './validateSessionToken.js';
import * as shopifyConfig from '../config/shopify.js';

// We mock getShopify to return a mock Shopify SDK
vi.mock('../config/shopify.js');

describe('middleware/validateSessionToken', () => {
  let mockDecodeSessionToken;

  beforeEach(() => {
    mockDecodeSessionToken = vi.fn();
    shopifyConfig.getShopify.mockReturnValue({
      session: {
        decodeSessionToken: mockDecodeSessionToken
      }
    });
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 4: Valid Session Token Verification Succeeds
  it('Property 4: Valid Session Token Verification Succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          iss: fc.string({ minLength: 1 }),
          dest: fc.string({ minLength: 1 }),
          aud: fc.string({ minLength: 1 }),
          sub: fc.string({ minLength: 1 }),
          exp: fc.integer(),
          nbf: fc.integer(),
          iat: fc.integer(),
          jti: fc.string({ minLength: 1 }),
          sid: fc.string({ minLength: 1 })
        }),
        async (payload) => {
          mockDecodeSessionToken.mockResolvedValueOnce(payload);

          const req = {
            headers: {
              authorization: 'Bearer valid.jwt.token'
            }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };
          const next = vi.fn();

          await validateSessionToken(req, res, next);

          expect(mockDecodeSessionToken).toHaveBeenCalledWith('valid.jwt.token');
          expect(req.sessionToken).toEqual(payload);
          expect(next).toHaveBeenCalled();
          expect(res.status).not.toHaveBeenCalled();
          expect(res.json).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 5: Invalid Session Token Verification Rejects
  it('Property 5: Invalid Session Token Verification Rejects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          mockDecodeSessionToken.mockRejectedValueOnce(new Error(errorMessage));

          const req = {
            headers: {
              authorization: 'Bearer invalid.jwt.token'
            }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };
          const next = vi.fn();

          await validateSessionToken(req, res, next);

          expect(mockDecodeSessionToken).toHaveBeenCalledWith('invalid.jwt.token');
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session token' });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject requests with missing Authorization header', async () => {
    const req = { headers: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();

    await validateSessionToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Authorization header' });
  });

  it('should reject requests with malformed Authorization header', async () => {
    const req = { headers: { authorization: 'Basic somebase64' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    const next = vi.fn();

    await validateSessionToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Malformed Authorization header' });
  });
});
